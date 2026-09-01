//! Fingerprint matching algorithm for hardware auto-detection.

use crate::forgedb::models::{DeviceMatch, ForgeDbBoard, ForgeDbFingerprint};

/// Match a simple glob pattern with '*' wildcards (case-insensitive).
pub fn glob_match(pattern: &str, text: &str) -> bool {
    let pattern = pattern.to_lowercase();
    let text = text.to_lowercase();

    let p: Vec<char> = pattern.chars().collect();
    let t: Vec<char> = text.chars().collect();

    let p_len = p.len();
    let t_len = t.len();

    let mut dp = vec![vec![false; t_len + 1]; p_len + 1];
    dp[0][0] = true;

    for i in 1..=p_len {
        if p[i - 1] == '*' {
            dp[i][0] = dp[i - 1][0];
        }
    }

    for i in 1..=p_len {
        for j in 1..=t_len {
            if p[i - 1] == '*' {
                dp[i][j] = dp[i - 1][j] || dp[i][j - 1];
            } else if p[i - 1] == '?' || p[i - 1] == t[j - 1] {
                dp[i][j] = dp[i - 1][j - 1];
            }
        }
    }

    dp[p_len][t_len]
}

/// Parse a human-readable storage string (e.g., "8GB", "16 GB", "512MB", "1TB") into bytes.
pub fn parse_storage_size(storage_str: &str) -> Option<u64> {
    let clean = storage_str.trim().to_uppercase();
    if clean.is_empty() {
        return None;
    }

    let (num_part, multiplier) = if clean.ends_with("TB") || clean.ends_with('T') {
        (clean.trim_end_matches("TB").trim_end_matches('T'), 1_000_000_000_000u64)
    } else if clean.ends_with("GB") || clean.ends_with('G') {
        (clean.trim_end_matches("GB").trim_end_matches('G'), 1_000_000_000u64)
    } else if clean.ends_with("MB") || clean.ends_with('M') {
        (clean.trim_end_matches("MB").trim_end_matches('M'), 1_000_000u64)
    } else if clean.ends_with("KB") || clean.ends_with('K') {
        (clean.trim_end_matches("KB").trim_end_matches('K'), 1_000u64)
    } else if clean.ends_with('B') {
        (clean.trim_end_matches('B'), 1u64)
    } else {
        (clean.as_str(), 1_000_000_000u64)
    };

    let num: f64 = num_part.trim().parse().ok()?;
    Some((num * multiplier as f64) as u64)
}

/// Match a connected block device against ForgeDB fingerprints.
/// Returns the highest confidence match if score >= 30, else None.
pub fn match_device(
    device_model: &str,
    device_bus: &str,
    device_size: u64,
    fingerprints: &[ForgeDbFingerprint],
    boards: &[ForgeDbBoard],
) -> Option<DeviceMatch> {
    let mut best_match: Option<DeviceMatch> = None;
    let mut highest_score: u32 = 0;

    for fp in fingerprints {
        let board = boards.iter().find(|b| b.id == fp.device_id || b.slug == fp.device_id);
        let board_name = board
            .map(|b| b.name.clone())
            .unwrap_or_else(|| fp.device_id.clone());

        let mut score: u32 = 0;
        let mut matched_by: Vec<String> = Vec::new();

        // 1. USB VID:PID match (+50 points)
        if !fp.usb.is_empty() {
            let model_lower = device_model.to_lowercase();
            for usb in &fp.usb {
                let vid_pid = format!("{}:{}", usb.vid, usb.pid).to_lowercase();
                let vid_pid_alt = format!("vid_{}&pid_{}", usb.vid, usb.pid).to_lowercase();
                if model_lower.contains(&vid_pid) || model_lower.contains(&vid_pid_alt) {
                    score += 50;
                    matched_by.push(format!("usb_vid_pid ({}:{})", usb.vid, usb.pid));
                    break;
                }
            }
        }

        // 2. storage_model.patterns glob match against device model name (+30 points)
        if let Some(ref storage_model) = fp.storage_model {
            for pattern in &storage_model.patterns {
                if glob_match(pattern, device_model) {
                    score += 30;
                    matched_by.push(format!("storage_model ({})", pattern));
                    break;
                }
            }
        }

        // 3. Device size within expected range for the board's storage (+10 points)
        if let Some(b) = board {
            if let Some(expected_bytes) = parse_storage_size(&b.memory.storage) {
                if device_size > 0 {
                    let min_bytes = (expected_bytes as f64 * 0.5) as u64;
                    let max_bytes = (expected_bytes as f64 * 1.5) as u64;
                    if device_size >= min_bytes && device_size <= max_bytes {
                        score += 10;
                        matched_by.push(format!("storage_size ({})", b.memory.storage));
                    }
                }
            }
        }

        // 4. Bus type is USB/SD and board supports emmc/usb/sd boot (+5 points)
        let bus_upper = device_bus.to_uppercase();
        if bus_upper == "USB" || bus_upper == "SD" {
            if let Some(b) = board {
                let supports_boot = b.boot_media.iter().any(|m| {
                    let m_lower = m.to_lowercase();
                    m_lower == "emmc" || m_lower == "usb" || m_lower == "sd"
                });
                if supports_boot {
                    score += 5;
                    matched_by.push(format!("bus_type ({})", device_bus));
                }
            }
        }

        // Match threshold: score >= 30
        if score >= 30 && score > highest_score {
            highest_score = score;
            let confidence = (score as f32 / 100.0).min(1.0);
            best_match = Some(DeviceMatch {
                device_id: fp.device_id.clone(),
                board_name,
                confidence,
                matched_by,
            });
        }
    }

    best_match
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::forgedb::models::{
        FingerprintCpuinfo, FingerprintDeviceTree, FingerprintStorageModel, FingerprintUsb,
        ForgeDbMemory, ForgeDbSoc,
    };

    fn sample_board() -> ForgeDbBoard {
        ForgeDbBoard {
            id: "btve10".to_string(),
            slug: "btv-e10".to_string(),
            name: "BTV E10".to_string(),
            manufacturer: "BTV".to_string(),
            category: "TV Box".to_string(),
            status: "supported".to_string(),
            description: Some("Test board".to_string()),
            soc: ForgeDbSoc {
                vendor: "Amlogic".to_string(),
                model: "S905X2".to_string(),
                family: "Meson G12A".to_string(),
                architecture: "ARM64".to_string(),
            },
            memory: ForgeDbMemory {
                ram: "2GB".to_string(),
                storage: "8GB".to_string(),
                storage_type: "eMMC".to_string(),
            },
            boot_media: vec!["emmc".to_string(), "usb".to_string(), "sd".to_string()],
            image_count: 1,
            has_desktop: true,
            photo_url: None,
        }
    }

    fn sample_fingerprint() -> ForgeDbFingerprint {
        ForgeDbFingerprint {
            device_id: "btve10".to_string(),
            cpuinfo: Some(FingerprintCpuinfo {
                hardware: Some("Amlogic".to_string()),
                cpu_family: Some("Meson G12A (S905X2)".to_string()),
            }),
            device_tree: Some(FingerprintDeviceTree {
                compatible: vec!["btv,e10".to_string(), "sei,sei510".to_string()],
                model: Some("BTV E10".to_string()),
            }),
            usb: vec![FingerprintUsb {
                vid: "05c6".to_string(),
                pid: "9008".to_string(),
                description: Some("Qualcomm EDL".to_string()),
            }],
            storage_model: Some(FingerprintStorageModel {
                patterns: vec![
                    "*SEI510*".to_string(),
                    "*BTV*".to_string(),
                    "*E10*".to_string(),
                    "*S905X2*".to_string(),
                ],
            }),
        }
    }

    #[test]
    fn test_glob_match() {
        assert!(glob_match("*SEI510*", "Amlogic SEI510 Flash Disk"));
        assert!(glob_match("*sei510*", "AMLOGIC SEI510"));
        assert!(glob_match("*BTV*", "BTV E10 Device"));
        assert!(glob_match("BTV*", "btv e10"));
        assert!(glob_match("*", "anything"));
        assert!(glob_match("", ""));
        assert!(!glob_match("*BTV*", "Generic USB Flash Disk"));
        assert!(!glob_match("exact", "other"));
    }

    #[test]
    fn test_parse_storage_size() {
        assert_eq!(parse_storage_size("8GB"), Some(8_000_000_000));
        assert_eq!(parse_storage_size("16 GB"), Some(16_000_000_000));
        assert_eq!(parse_storage_size("512MB"), Some(512_000_000));
        assert_eq!(parse_storage_size("1TB"), Some(1_000_000_000_000));
        assert_eq!(parse_storage_size(""), None);
    }

    #[test]
    fn test_match_device_success() {
        let boards = vec![sample_board()];
        let fps = vec![sample_fingerprint()];

        let result = match_device(
            "Amlogic SEI510 Flash Drive",
            "USB",
            7_800_000_000,
            &fps,
            &boards,
        );

        assert!(result.is_some());
        let m = result.unwrap();
        assert_eq!(m.device_id, "btve10");
        assert_eq!(m.board_name, "BTV E10");
        assert!(m.confidence >= 0.45);
        assert!(m.matched_by.iter().any(|s| s.contains("storage_model")));
        assert!(m.matched_by.iter().any(|s| s.contains("storage_size")));
        assert!(m.matched_by.iter().any(|s| s.contains("bus_type")));
    }

    #[test]
    fn test_match_device_unrelated_fails() {
        let boards = vec![sample_board()];
        let fps = vec![sample_fingerprint()];

        let result = match_device(
            "Samsung Portable SSD T7",
            "USB",
            500_000_000_000,
            &fps,
            &boards,
        );

        assert!(result.is_none());
    }
}
