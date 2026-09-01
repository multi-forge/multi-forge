//! ForgeDB catalog fetching with cascade fallback:
//! 1. jsDelivr CDN
//! 2. GitHub Pages
//! 3. GitHub Raw
//! 4. Local disk cache
//! 5. Built-in embedded catalog

use std::path::Path;

use crate::forgedb::models::ForgeDbCatalog;
use crate::{log_debug, log_info, log_warn};

pub const FORGEDB_JSDELIVR: &str =
    "https://cdn.jsdelivr.net/gh/multi-forge/multi-forge@main/ForgeDB/dist/catalog.min.json";
pub const FORGEDB_PAGES: &str =
    "https://multi-forge.github.io/multi-forge/api/catalog.min.json";
pub const FORGEDB_RAW: &str =
    "https://raw.githubusercontent.com/multi-forge/multi-forge/main/ForgeDB/dist/catalog.min.json";

const EMBEDDED_CATALOG: &str = include_str!("../../forgedb_builtin.json");

/// Returns the cascade URLs in priority order
pub fn get_catalog_urls() -> Vec<&'static str> {
    vec![FORGEDB_JSDELIVR, FORGEDB_PAGES, FORGEDB_RAW]
}

/// Load catalog from the local cache file
pub fn load_cached_catalog(cache_dir: &Path) -> Option<ForgeDbCatalog> {
    let cache_file = cache_dir.join("forgedb_catalog.json");
    if !cache_file.exists() {
        log_debug!("forgedb", "No local cache file at {}", cache_file.display());
        return None;
    }

    match std::fs::read_to_string(&cache_file) {
        Ok(data) => match serde_json::from_str::<ForgeDbCatalog>(&data) {
            Ok(catalog) => {
                log_info!(
                    "forgedb",
                    "Loaded ForgeDB catalog from cache ({})",
                    cache_file.display()
                );
                Some(catalog)
            }
            Err(e) => {
                log_warn!(
                    "forgedb",
                    "Failed to parse cached ForgeDB catalog {}: {}",
                    cache_file.display(),
                    e
                );
                None
            }
        },
        Err(e) => {
            log_warn!(
                "forgedb",
                "Failed to read cached ForgeDB catalog {}: {}",
                cache_file.display(),
                e
            );
            None
        }
    }
}

/// Save catalog to the local cache file
pub fn save_catalog_cache(cache_dir: &Path, catalog: &ForgeDbCatalog) {
    if let Err(e) = std::fs::create_dir_all(cache_dir) {
        log_warn!("forgedb", "Failed to create cache directory: {}", e);
        return;
    }

    let cache_file = cache_dir.join("forgedb_catalog.json");
    match serde_json::to_string_pretty(catalog) {
        Ok(json_str) => {
            let pid = std::process::id();
            let nanos = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0);
            let tmp_path = cache_file.with_extension(format!("json.{}.{}.tmp", pid, nanos));
            if let Err(e) = std::fs::write(&tmp_path, &json_str) {
                log_warn!("forgedb", "Failed to write temp cache file: {}", e);
                return;
            }
            if let Err(e) = std::fs::rename(&tmp_path, &cache_file) {
                log_warn!("forgedb", "Failed to rename temp cache file: {}", e);
                let _ = std::fs::remove_file(&tmp_path);
            } else {
                log_debug!("forgedb", "Saved ForgeDB catalog cache to {}", cache_file.display());
            }
        }
        Err(e) => {
            log_warn!("forgedb", "Failed to serialize ForgeDB catalog for caching: {}", e);
        }
    }
}

/// Try to find and load catalog from a local workspace directory (for local dev / offline testing)
fn try_load_workspace_catalog() -> Option<(ForgeDbCatalog, String)> {
    let mut candidate_paths = vec![
        Path::new("multi-forge/ForgeDB/dist/catalog.min.json").to_path_buf(),
        Path::new("multi-forge/ForgeDB/dist/catalog.json").to_path_buf(),
        Path::new("ForgeDB/dist/catalog.min.json").to_path_buf(),
        Path::new("ForgeDB/dist/catalog.json").to_path_buf(),
        Path::new("../ForgeDB/dist/catalog.min.json").to_path_buf(),
        Path::new("../ForgeDB/dist/catalog.json").to_path_buf(),
        Path::new("../../ForgeDB/dist/catalog.min.json").to_path_buf(),
        Path::new("../../ForgeDB/dist/catalog.json").to_path_buf(),
    ];

    if let Ok(cwd) = std::env::current_dir() {
        candidate_paths.push(cwd.join("multi-forge/ForgeDB/dist/catalog.min.json"));
        candidate_paths.push(cwd.join("multi-forge/ForgeDB/dist/catalog.json"));
        candidate_paths.push(cwd.join("ForgeDB/dist/catalog.min.json"));
        candidate_paths.push(cwd.join("ForgeDB/dist/catalog.json"));
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            candidate_paths.push(parent.join("multi-forge/ForgeDB/dist/catalog.min.json"));
            candidate_paths.push(parent.join("multi-forge/ForgeDB/dist/catalog.json"));
            candidate_paths.push(parent.join("ForgeDB/dist/catalog.min.json"));
            candidate_paths.push(parent.join("ForgeDB/dist/catalog.json"));
            if let Some(grandparent) = parent.parent() {
                candidate_paths.push(grandparent.join("multi-forge/ForgeDB/dist/catalog.min.json"));
                candidate_paths.push(grandparent.join("multi-forge/ForgeDB/dist/catalog.json"));
                candidate_paths.push(grandparent.join("ForgeDB/dist/catalog.min.json"));
                candidate_paths.push(grandparent.join("ForgeDB/dist/catalog.json"));
            }
        }
    }

    for path in &candidate_paths {
        if path.exists() {
            if let Ok(data) = std::fs::read_to_string(path) {
                if let Ok(catalog) = serde_json::from_str::<ForgeDbCatalog>(&data) {
                    log_info!(
                        "forgedb",
                        "Loaded ForgeDB catalog from local workspace: {} ({} boards, {} images)",
                        path.display(),
                        catalog.boards.len(),
                        catalog.images.len()
                    );
                    return Some((catalog, format!("local_workspace:{}", path.display())));
                }
            }
        }
    }
    None
}

/// Fetch the ForgeDB catalog with fallback cascade, returning catalog and source description
pub async fn fetch_forgedb_catalog_with_source(
    client: &reqwest::Client,
    cache_dir: &Path,
) -> Result<(ForgeDbCatalog, String), String> {
    // 0. Workspace check: if running in repo with compiled dist/, use it immediately
    if let Some((catalog, source)) = try_load_workspace_catalog() {
        save_catalog_cache(cache_dir, &catalog);
        return Ok((catalog, source));
    }

    for url in get_catalog_urls() {
        log_debug!("forgedb", "Fetching ForgeDB catalog from {}", url);
        match client.get(url).send().await {
            Ok(resp) if resp.status().is_success() => {
                match resp.text().await {
                    Ok(text) => match serde_json::from_str::<ForgeDbCatalog>(&text) {
                        Ok(catalog) => {
                            log_info!(
                                "forgedb",
                                "Successfully loaded ForgeDB catalog from {} ({} boards, {} images)",
                                url,
                                catalog.boards.len(),
                                catalog.images.len()
                            );
                            save_catalog_cache(cache_dir, &catalog);
                            return Ok((catalog, url.to_string()));
                        }
                        Err(e) => {
                            log_debug!("forgedb", "Failed to parse catalog JSON from {}: {}", url, e);
                        }
                    },
                    Err(e) => {
                        log_debug!("forgedb", "Failed to read response body from {}: {}", url, e);
                    }
                }
            }
            Ok(resp) => {
                log_debug!("forgedb", "Catalog request to {} returned HTTP {}", url, resp.status());
            }
            Err(e) => {
                log_debug!("forgedb", "Failed to reach catalog URL {}: {}", url, e);
            }
        }
    }

    // Fallback: Local disk cache
    if let Some(cached) = load_cached_catalog(cache_dir) {
        log_info!("forgedb", "Using cached ForgeDB catalog as fallback");
        return Ok((cached, "local_cache".to_string()));
    }

    // Last resort: Embedded catalog
    log_warn!("forgedb", "Using built-in embedded ForgeDB catalog as last resort");
    match serde_json::from_str::<ForgeDbCatalog>(EMBEDDED_CATALOG) {
        Ok(builtin) => Ok((builtin, "embedded".to_string())),
        Err(e) => Err(format!(
            "Failed to parse embedded ForgeDB fallback catalog: {}",
            e
        )),
    }
}

/// Fetch the ForgeDB catalog with fallback cascade
pub async fn fetch_forgedb_catalog(
    client: &reqwest::Client,
    cache_dir: &Path,
) -> Result<ForgeDbCatalog, String> {
    fetch_forgedb_catalog_with_source(client, cache_dir)
        .await
        .map(|(cat, _)| cat)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_embedded_catalog_is_valid() {
        let catalog: Result<ForgeDbCatalog, _> = serde_json::from_str(EMBEDDED_CATALOG);
        assert!(catalog.is_ok(), "Embedded catalog must be valid JSON matching schema: {:?}", catalog.err());
        let cat = catalog.unwrap();
        assert!(!cat.boards.is_empty(), "Embedded catalog must contain at least one board");
        assert_eq!(cat.boards[0].id, "btv-e10");
        assert!(!cat.images.is_empty(), "Embedded catalog must contain images");
        assert!(!cat.fingerprints.is_empty(), "Embedded catalog must contain fingerprints");
    }

    #[test]
    fn test_get_catalog_urls() {
        let urls = get_catalog_urls();
        assert_eq!(urls.len(), 3);
        assert_eq!(urls[0], FORGEDB_JSDELIVR);
        assert_eq!(urls[1], FORGEDB_PAGES);
        assert_eq!(urls[2], FORGEDB_RAW);
    }
}
