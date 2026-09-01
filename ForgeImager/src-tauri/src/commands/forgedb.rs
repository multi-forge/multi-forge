//! ForgeDB Tauri commands: hardware auto-detection and catalog status.

use tauri::State;

use crate::commands::state::AppState;
use crate::forgedb::catalog::fetch_forgedb_catalog_with_source;
use crate::forgedb::fingerprint::match_device;
use crate::forgedb::models::{DeviceMatch, ForgeDbStatus};
use crate::utils::{assets_dir, build_client};
use crate::{log_debug, log_info};

/// Detect board for a connected block device based on ForgeDB fingerprints
#[tauri::command]
pub async fn detect_board_for_device(
    device_model: String,
    device_bus: String,
    device_size: u64,
    state: State<'_, AppState>,
) -> Result<Option<DeviceMatch>, String> {
    log_debug!(
        "forgedb",
        "Detecting board for device: model='{}', bus='{}', size={}",
        device_model,
        device_bus,
        device_size
    );

    let mut catalog_guard = state.forgedb_catalog.lock().await;
    if catalog_guard.is_none() {
        let client = build_client(std::time::Duration::from_secs(15))
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
        let cache_dir = assets_dir();
        let (catalog, source) = fetch_forgedb_catalog_with_source(&client, &cache_dir).await?;
        *state.forgedb_source.lock().await = Some(source);
        *catalog_guard = Some(catalog);
    }

    let catalog = catalog_guard
        .as_ref()
        .ok_or_else(|| "ForgeDB catalog is not available".to_string())?;

    let matched = match_device(
        &device_model,
        &device_bus,
        device_size,
        &catalog.fingerprints,
        &catalog.boards,
    );

    if let Some(ref m) = matched {
        log_info!(
            "forgedb",
            "Matched device '{}' to board '{}' (confidence: {:.2}, matched by: {:?})",
            device_model,
            m.board_name,
            m.confidence,
            m.matched_by
        );
    } else {
        log_debug!("forgedb", "No board match found for device '{}'", device_model);
    }

    Ok(matched)
}

/// Get current ForgeDB catalog status and source info
#[tauri::command]
pub async fn get_forgedb_status(
    state: State<'_, AppState>,
) -> Result<ForgeDbStatus, String> {
    log_debug!("forgedb", "Getting ForgeDB status");

    let mut catalog_guard = state.forgedb_catalog.lock().await;
    if catalog_guard.is_none() {
        let client = build_client(std::time::Duration::from_secs(15))
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
        let cache_dir = assets_dir();
        let (catalog, source) = fetch_forgedb_catalog_with_source(&client, &cache_dir).await?;
        *state.forgedb_source.lock().await = Some(source);
        *catalog_guard = Some(catalog);
    }

    let catalog = catalog_guard
        .as_ref()
        .ok_or_else(|| "ForgeDB catalog is not available".to_string())?;

    let source = state
        .forgedb_source
        .lock()
        .await
        .clone()
        .unwrap_or_else(|| "unknown".to_string());

    Ok(ForgeDbStatus {
        version: catalog.version.clone(),
        board_count: if catalog.board_count > 0 {
            catalog.board_count
        } else {
            catalog.boards.len() as u32
        },
        image_count: if catalog.image_count > 0 {
            catalog.image_count
        } else {
            catalog.images.len() as u32
        },
        last_updated: catalog.generated_at.clone(),
        source,
    })
}
