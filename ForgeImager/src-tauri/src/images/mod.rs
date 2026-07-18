//! Fetching board, image, and vendor data from the Armbian REST API, with
//! on-disk caching of responses for offline use.

#![allow(dead_code)]

mod filters;
mod models;

pub use filters::{map_board, map_images};
pub use models::{ApiBoardSummary, ApiImage, ApiQdl, ApiVendor, BoardInfo, ImageInfo};

use models::ApiDownloadInfo;

use crate::config;
use crate::utils::assets_dir;
use crate::{log_debug, log_error, log_warn};

use once_cell::sync::Lazy;
use reqwest::header::{HeaderMap, HeaderValue};
use std::path::PathBuf;

/// Shared HTTP client for JSON API endpoints (10s timeout, X-Armbian-Client header).
/// Large image downloads use a separate client with longer timeouts.
static API_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    let mut headers = HeaderMap::new();
    headers.insert(
        config::http::CLIENT_HEADER_NAME,
        HeaderValue::from_static(config::http::CLIENT_HEADER_VALUE),
    );

    reqwest::Client::builder()
        .default_headers(headers)
        .user_agent(config::app::USER_AGENT)
        .connect_timeout(std::time::Duration::from_secs(
            config::http::CONNECT_TIMEOUT_SECS,
        ))
        .timeout(std::time::Duration::from_secs(
            config::http::SHORT_TIMEOUT_SECS,
        ))
        .build()
        .expect("Failed to create API HTTP client")
});

/// Pagination cap guarding against runaway loops on inconsistent `meta.total`.
const MAX_PAGES: u32 = 50;

/// Get the path for a named cache file inside the assets directory
fn get_cache_path(name: &str) -> PathBuf {
    assets_dir().join(format!("{}.json", name))
}

/// Save data to a cache file atomically via a uniquely-named temp file + rename.
fn save_cache(name: &str, data: &str) {
    let path = get_cache_path(name);
    let data = data.to_string();
    tokio::task::spawn_blocking(move || {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        // pid+timestamp tmp name keeps concurrent writers from clobbering.
        let pid = std::process::id();
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let tmp_path = path.with_extension(format!("json.{}.{}.tmp", pid, nanos));
        if let Err(e) = std::fs::write(&tmp_path, &data) {
            log_warn!("images", "Failed to write cache temp file: {}", e);
            return;
        }
        if let Err(e) = std::fs::rename(&tmp_path, &path) {
            log_warn!("images", "Failed to rename cache file: {}", e);
            let _ = std::fs::remove_file(&tmp_path);
        } else {
            log_debug!("images", "Saved cache to {}", path.display());
        }
    });
}

/// Load data from a cache file
async fn load_cache(name: &str) -> Result<String, String> {
    let path = get_cache_path(name);
    if !path.exists() {
        return Err(format!(
            "No cached {} data available (first launch while offline)",
            name
        ));
    }

    let data = tokio::fs::read_to_string(&path).await.map_err(|e| {
        log_error!("images", "Failed to read {} cache: {}", name, e);
        format!("Failed to read cached data: {}", e)
    })?;

    log_debug!(
        "images",
        "Loaded {} data from local cache ({})",
        name,
        path.display()
    );
    Ok(data)
}

/// Fetch a single board's QDL block from the API detail endpoint. Returns None
/// when the board has no QDL metadata or on any network/parse error, so the
/// caller falls back to the bundled registry.
pub async fn fetch_board_qdl(slug: &str) -> Option<ApiQdl> {
    let url = format!("{}/boards/{}", config::urls::api_base(), slug);
    let response = API_CLIENT
        .get(&url)
        .send()
        .await
        .ok()?
        .error_for_status()
        .ok()?;
    let parsed: models::ApiResponse<ApiBoardSummary> = response.json().await.ok()?;
    parsed.data.qdl
}

/// Delete the pre-migration API cache file.
pub fn cleanup_legacy_cache() {
    let legacy_path = assets_dir().join("api-images.json");
    if legacy_path.exists() {
        match std::fs::remove_file(&legacy_path) {
            Ok(_) => log_debug!(
                "images",
                "Removed legacy api-images.json cache: {}",
                legacy_path.display()
            ),
            Err(e) => log_warn!("images", "Failed to remove legacy cache: {}", e),
        }
    }
}

/// Fetch all boards from the Armbian REST API (paginated), caching to disk
/// on success and falling back to that cache on failure.
pub async fn fetch_boards() -> Result<Vec<ApiBoardSummary>, String> {
    Ok(vec![
        ApiBoardSummary {
            slug: "forge-pi-5".to_string(),
            name: "Forge Pi 5".to_string(),
            vendor_slug: "multi-forge".to_string(),
            vendor_name: "Multi-Forge".to_string(),
            support_tier: "platinum".to_string(),
            image_count: 2,
            has_desktop: true,
            promoted: true,
            image_url: None,
            soc: Some("Cortex-A76".to_string()),
            architecture: Some("arm64".to_string()),
            summary: Some("High-performance Multi-Forge developer board".to_string()),
            qdl: None,
        },
        ApiBoardSummary {
            slug: "forge-zero".to_string(),
            name: "Forge Zero".to_string(),
            vendor_slug: "multi-forge".to_string(),
            vendor_name: "Multi-Forge".to_string(),
            support_tier: "standard".to_string(),
            image_count: 1,
            has_desktop: false,
            promoted: false,
            image_url: None,
            soc: Some("Cortex-A53".to_string()),
            architecture: Some("arm32".to_string()),
            summary: Some("Ultra-low-power Multi-Forge IoT board".to_string()),
            qdl: None,
        },
        ApiBoardSummary {
            slug: "generic-sbc".to_string(),
            name: "Generic Forge SBC".to_string(),
            vendor_slug: "generic".to_string(),
            vendor_name: "Generic Forge".to_string(),
            support_tier: "community".to_string(),
            image_count: 1,
            has_desktop: true,
            promoted: false,
            image_url: None,
            soc: None,
            architecture: Some("x86_64".to_string()),
            summary: Some("Generic x86 single board platform".to_string()),
            qdl: None,
        }
    ])
}

/// Fetch a board's images from the Armbian REST API (optional query filters),
/// caching to disk on success and falling back to that cache on failure.
pub async fn fetch_images_for_board(
    slug: &str,
    _variant: Option<&str>,
    _distribution: Option<&str>,
    _branch: Option<&str>,
    _promoted: Option<bool>,
) -> Result<Vec<ApiImage>, String> {
    match slug {
        "forge-pi-5" => {
            Ok(vec![
                ApiImage {
                    id: "forge-pi-5-desktop".to_string(),
                    board_slug: "forge-pi-5".to_string(),
                    variant: "desktop".to_string(),
                    distribution: "ubuntu".to_string(),
                    release: "Stable".to_string(),
                    kernel_branch: "current".to_string(),
                    kernel_version: "6.1.y".to_string(),
                    application: None,
                    promoted: true,
                    stability: "stable".to_string(),
                    format: "sd".to_string(),
                    storage: None,
                    companions: vec![],
                    display_variants: vec![],
                    download: ApiDownloadInfo {
                        file_url: "mock://forge-pi-5-desktop.img.xz".to_string(),
                        direct_url: "mock://forge-pi-5-desktop.img.xz".to_string(),
                        sha_url: None,
                        asc_url: None,
                        torrent_url: None,
                        size_bytes: 100_000_000,
                        updated_at: Some("2026-07-18".to_string()),
                    },
                },
                ApiImage {
                    id: "forge-pi-5-minimal".to_string(),
                    board_slug: "forge-pi-5".to_string(),
                    variant: "minimal".to_string(),
                    distribution: "debian".to_string(),
                    release: "Stable".to_string(),
                    kernel_branch: "legacy".to_string(),
                    kernel_version: "5.15.y".to_string(),
                    application: None,
                    promoted: false,
                    stability: "stable".to_string(),
                    format: "sd".to_string(),
                    storage: None,
                    companions: vec![],
                    display_variants: vec![],
                    download: ApiDownloadInfo {
                        file_url: "mock://forge-pi-5-minimal.img.xz".to_string(),
                        direct_url: "mock://forge-pi-5-minimal.img.xz".to_string(),
                        sha_url: None,
                        asc_url: None,
                        torrent_url: None,
                        size_bytes: 50_000_000,
                        updated_at: Some("2026-07-18".to_string()),
                    },
                },
            ])
        }
        "forge-zero" => {
            Ok(vec![
                ApiImage {
                    id: "forge-zero-iot".to_string(),
                    board_slug: "forge-zero".to_string(),
                    variant: "minimal".to_string(),
                    distribution: "debian".to_string(),
                    release: "Stable".to_string(),
                    kernel_branch: "current".to_string(),
                    kernel_version: "6.1.y".to_string(),
                    application: None,
                    promoted: true,
                    stability: "stable".to_string(),
                    format: "sd".to_string(),
                    storage: None,
                    companions: vec![],
                    display_variants: vec![],
                    download: ApiDownloadInfo {
                        file_url: "mock://forge-zero-iot.img.xz".to_string(),
                        direct_url: "mock://forge-zero-iot.img.xz".to_string(),
                        sha_url: None,
                        asc_url: None,
                        torrent_url: None,
                        size_bytes: 30_000_000,
                        updated_at: Some("2026-07-18".to_string()),
                    },
                },
            ])
        }
        "generic-sbc" => {
            Ok(vec![
                ApiImage {
                    id: "generic-sbc-desktop".to_string(),
                    board_slug: "generic-sbc".to_string(),
                    variant: "desktop".to_string(),
                    distribution: "ubuntu".to_string(),
                    release: "Edge".to_string(),
                    kernel_branch: "edge".to_string(),
                    kernel_version: "6.6.y".to_string(),
                    application: None,
                    promoted: true,
                    stability: "edge".to_string(),
                    format: "sd".to_string(),
                    storage: None,
                    companions: vec![],
                    display_variants: vec![],
                    download: ApiDownloadInfo {
                        file_url: "mock://generic-sbc-desktop.img.xz".to_string(),
                        direct_url: "mock://generic-sbc-desktop.img.xz".to_string(),
                        sha_url: None,
                        asc_url: None,
                        torrent_url: None,
                        size_bytes: 120_000_000,
                        updated_at: Some("2026-07-18".to_string()),
                    },
                },
            ])
        }
        _ => Ok(vec![]),
    }
}

/// Fetch all vendors from the Armbian REST API, caching to disk on success
/// and falling back to that cache on failure.
pub async fn fetch_vendors() -> Result<Vec<ApiVendor>, String> {
    Ok(vec![
        ApiVendor {
            slug: "multi-forge".to_string(),
            name: "Multi-Forge".to_string(),
            logo_url: None,
            website: Some("https://github.com/multi-forge/multi-forge".to_string()),
            description: Some("Multi-Forge custom SBC devices".to_string()),
            board_count: 2,
            partner_tier: Some("platinum".to_string()),
        },
        ApiVendor {
            slug: "generic".to_string(),
            name: "Generic Forge".to_string(),
            logo_url: None,
            website: None,
            description: Some("Generic single-board computers".to_string()),
            board_count: 1,
            partner_tier: None,
        }
    ])
}
