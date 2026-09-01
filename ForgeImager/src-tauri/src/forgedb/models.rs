//! ForgeDB data models matching the compiled catalog schema.

use serde::{Deserialize, Serialize};

/// Root structure of the ForgeDB compiled catalog
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForgeDbCatalog {
    pub version: String,
    pub generated_at: String,
    pub commit_sha: String,
    #[serde(default)]
    pub board_count: u32,
    #[serde(default)]
    pub image_count: u32,
    #[serde(default)]
    pub boards: Vec<ForgeDbBoard>,
    #[serde(default)]
    pub images: Vec<ForgeDbImage>,
    #[serde(default)]
    pub vendors: Vec<ForgeDbVendor>,
    #[serde(default)]
    pub fingerprints: Vec<ForgeDbFingerprint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForgeDbBoard {
    pub id: String,
    pub slug: String,
    pub name: String,
    pub manufacturer: String,
    pub category: String,
    pub status: String,
    #[serde(default)]
    pub description: Option<String>,
    pub soc: ForgeDbSoc,
    pub memory: ForgeDbMemory,
    #[serde(default)]
    pub boot_media: Vec<String>,
    #[serde(default)]
    pub image_count: u32,
    #[serde(default)]
    pub has_desktop: bool,
    #[serde(default)]
    pub photo_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForgeDbSoc {
    pub vendor: String,
    pub model: String,
    #[serde(default)]
    pub family: String,
    pub architecture: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForgeDbMemory {
    pub ram: String,
    pub storage: String,
    #[serde(default)]
    pub storage_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForgeDbImage {
    pub id: String,
    pub device_id: String,
    pub distribution: String,
    pub variant: String,
    pub version: String,
    #[serde(default)]
    pub kernel: Option<ForgeDbKernel>,
    #[serde(default)]
    pub stability: String,
    #[serde(default)]
    pub recommended: bool,
    pub download: ForgeDbDownload,
    #[serde(default)]
    pub flash_target: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForgeDbKernel {
    #[serde(default)]
    pub branch: String,
    #[serde(default)]
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForgeDbDownload {
    pub url: String,
    #[serde(default)]
    pub sha256_url: Option<String>,
    #[serde(default)]
    pub size_bytes: Option<u64>,
    #[serde(default)]
    pub format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForgeDbVendor {
    #[serde(alias = "id", default)]
    pub slug: String,
    pub name: String,
    #[serde(default)]
    pub logo_url: Option<String>,
    #[serde(default)]
    pub website: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub board_count: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForgeDbFingerprint {
    pub device_id: String,
    #[serde(default)]
    pub cpuinfo: Option<FingerprintCpuinfo>,
    #[serde(default)]
    pub device_tree: Option<FingerprintDeviceTree>,
    #[serde(default)]
    pub usb: Vec<FingerprintUsb>,
    #[serde(default)]
    pub storage_model: Option<FingerprintStorageModel>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FingerprintCpuinfo {
    #[serde(default)]
    pub hardware: Option<String>,
    #[serde(default)]
    pub cpu_family: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FingerprintDeviceTree {
    #[serde(default)]
    pub compatible: Vec<String>,
    #[serde(default)]
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FingerprintUsb {
    pub vid: String,
    pub pid: String,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FingerprintStorageModel {
    #[serde(default)]
    pub patterns: Vec<String>,
}

/// Result of matching a connected device against ForgeDB fingerprints
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceMatch {
    pub device_id: String,
    pub board_name: String,
    pub confidence: f32,
    pub matched_by: Vec<String>,
}

/// Status of the ForgeDB catalog
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForgeDbStatus {
    pub version: String,
    pub board_count: u32,
    pub image_count: u32,
    pub last_updated: String,
    pub source: String,
}
