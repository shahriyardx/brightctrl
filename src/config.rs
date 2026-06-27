//! TOML config at `~/.config/brightctrl/config.toml`: aliases + UI mode flags.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

use crate::ddc::Monitor;

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Config {
    #[serde(default)]
    pub aliases: HashMap<String, String>,
    #[serde(default)]
    pub sync_mode: bool,
    #[serde(default)]
    pub precise_mode: bool,
}

fn config_dir() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from(".config"))
        .join("brightctrl")
}

pub fn config_path() -> PathBuf {
    config_dir().join("config.toml")
}

fn monitors_cache_path() -> PathBuf {
    config_dir().join("monitors.json")
}

/// Read the last detected monitor list for instant startup. Cached monitors
/// have no open i2c handle yet — it's opened lazily on first set.
pub fn read_monitor_cache() -> Option<Vec<Monitor>> {
    let raw = std::fs::read_to_string(monitors_cache_path()).ok()?;
    serde_json::from_str(&raw).ok()
}

pub fn write_monitor_cache(monitors: &[Monitor]) {
    let path = monitors_cache_path();
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    if let Ok(raw) = serde_json::to_string_pretty(monitors) {
        let _ = std::fs::write(&path, raw);
    }
}

impl Config {
    pub fn load() -> Self {
        let path = config_path();
        match std::fs::read_to_string(&path) {
            Ok(raw) => toml::from_str(&raw).unwrap_or_default(),
            Err(_) => {
                let cfg = Self::default();
                cfg.save();
                cfg
            }
        }
    }

    pub fn save(&self) {
        let path = config_path();
        if let Some(dir) = path.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        if let Ok(raw) = toml::to_string_pretty(self) {
            let _ = std::fs::write(&path, raw);
        }
    }

    pub fn alias_of(&self, id: &str) -> Option<&String> {
        self.aliases.get(id)
    }

    pub fn set_alias(&mut self, id: &str, alias: &str) {
        self.aliases.insert(id.to_string(), alias.to_string());
        self.save();
    }

    pub fn unset_alias(&mut self, id: &str) -> Option<String> {
        let removed = self.aliases.remove(id);
        self.save();
        removed
    }
}
