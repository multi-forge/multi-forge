//! Defines the shared application state used across commands.

use std::sync::Arc;
use tokio::sync::Mutex;

use crate::download::DownloadState;
use crate::flash::FlashState;
use crate::forgedb::models::ForgeDbCatalog;
use crate::images::{ApiBoardSummary, ApiVendor};

/// Application state shared across all commands
pub struct AppState {
    /// Cached board list from the REST API
    pub boards: Mutex<Option<Vec<ApiBoardSummary>>>,
    /// Cached vendor list from the REST API
    pub vendors: Mutex<Option<Vec<ApiVendor>>>,
    /// Cached ForgeDB catalog
    pub forgedb_catalog: Mutex<Option<ForgeDbCatalog>>,
    /// Source of the loaded ForgeDB catalog
    pub forgedb_source: Mutex<Option<String>>,
    pub download_state: Arc<DownloadState>,
    pub flash_state: Arc<FlashState>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            boards: Mutex::new(None),
            vendors: Mutex::new(None),
            forgedb_catalog: Mutex::new(None),
            forgedb_source: Mutex::new(None),
            download_state: Arc::new(DownloadState::new()),
            flash_state: Arc::new(FlashState::new()),
        }
    }
}
