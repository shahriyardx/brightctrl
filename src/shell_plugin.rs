//! Installs the Omarchy shell bar widget.
//!
//! The Omarchy shell only discovers plugins in two places: its own package
//! directory, and `~/.config/omarchy/plugins/<id>/`. A distro package can't
//! write to either at build time, so the QML ships as package data and gets
//! copied into the user's config on demand.

use anyhow::{anyhow, Result};
use std::path::{Path, PathBuf};

/// Must match the `id` in `shell/manifest.json` — it names the install
/// directory the shell scans.
const PLUGIN_ID: &str = "brightctrl.brightness";

/// Files that make up the plugin. Kept explicit so a stray file in the source
/// directory never lands in the user's config.
const FILES: [&str; 2] = ["manifest.json", "Panel.qml"];

fn install_dir() -> Result<PathBuf> {
    let config = dirs::config_dir().ok_or_else(|| anyhow!("could not locate the config dir"))?;
    Ok(config.join("omarchy").join("plugins").join(PLUGIN_ID))
}

/// Where the packaged QML lives. Checked in order so an explicit override wins,
/// then a system install, then a binary run straight out of the source tree.
fn source_dir() -> Result<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(dir) = std::env::var("BRIGHTCTRL_SHELL_DIR") {
        candidates.push(PathBuf::from(dir));
    }
    candidates.push(PathBuf::from("/usr/share/brightctrl/shell"));
    candidates.push(PathBuf::from("/usr/local/share/brightctrl/shell"));

    // A relocatable install: <prefix>/bin/brightctrl -> <prefix>/share/...
    if let Ok(exe) = std::env::current_exe() {
        if let Some(prefix) = exe.parent().and_then(Path::parent) {
            candidates.push(prefix.join("share").join("brightctrl").join("shell"));
        }
    }

    // Running from a cargo build in the source tree.
    candidates.push(PathBuf::from(concat!(env!("CARGO_MANIFEST_DIR"), "/shell")));

    candidates
        .into_iter()
        .find(|dir| dir.join("manifest.json").is_file())
        .ok_or_else(|| {
            anyhow!("could not find the bundled shell plugin; set BRIGHTCTRL_SHELL_DIR to its directory")
        })
}

pub fn install(force: bool) -> Result<()> {
    let source = source_dir()?;
    let target = install_dir()?;

    if target.exists() && !force {
        return Err(anyhow!(
            "{} already exists; pass --force to overwrite",
            target.display()
        ));
    }

    std::fs::create_dir_all(&target)?;
    for name in FILES {
        let from = source.join(name);
        if !from.is_file() {
            return Err(anyhow!("missing {} in {}", name, source.display()));
        }
        std::fs::copy(&from, target.join(name))?;
    }

    println!("installed {PLUGIN_ID} to {}", target.display());
    println!();
    println!("Enable it with:");
    println!("  omarchy-shell shell rescanPlugins");
    println!("  omarchy plugin enable {PLUGIN_ID}");
    Ok(())
}

pub fn uninstall() -> Result<()> {
    let target = install_dir()?;
    if !target.exists() {
        return Err(anyhow!("{} is not installed", PLUGIN_ID));
    }
    std::fs::remove_dir_all(&target)?;
    println!("removed {}", target.display());
    println!();
    println!("Drop it from the bar with:");
    println!("  omarchy plugin disable {PLUGIN_ID}");
    println!("  omarchy-shell shell rescanPlugins");
    Ok(())
}
