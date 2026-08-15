//! Headless commands: list / get / set / alias. Runs when args are present.

use anyhow::{anyhow, Result};
use clap::{Parser, Subcommand};
use serde::Serialize;

use crate::config::{self, Config};
use crate::ddc::{self, Monitor};

#[derive(Parser)]
#[command(
    name = "brightctrl",
    version,
    about = "DDC/CI external monitor brightness control",
    long_about = "Run with no command to launch the TUI."
)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Option<Cmd>,
}

#[derive(Subcommand)]
pub enum Cmd {
    /// List detected monitors with ids, aliases and brightness
    List {
        /// Emit JSON instead of a table
        #[arg(long)]
        json: bool,
        /// Read the cached monitor list instead of rescanning the i2c bus
        #[arg(long)]
        fast: bool,
    },
    /// Get brightness (0-100) for a monitor
    Get {
        /// Monitor number, id, or alias
        target: String,
        /// Read the cached value instead of rescanning the i2c bus
        #[arg(long)]
        fast: bool,
    },
    /// Set brightness (0-100) for a monitor
    Set {
        /// Monitor number, id, or alias
        target: String,
        /// Brightness value 0-100
        value: u16,
        /// Always rescan the i2c bus instead of resolving from the cache
        #[arg(long)]
        no_cache: bool,
    },
    /// Register or remove a human-friendly alias for a monitor id
    Alias {
        /// Monitor id (see `list`)
        id: String,
        /// Alias name; omit to remove the existing alias
        name: Option<String>,
    },
    /// Manage the Omarchy shell bar widget
    Shell {
        #[command(subcommand)]
        action: ShellCmd,
    },
}

#[derive(Subcommand)]
pub enum ShellCmd {
    /// Copy the bar widget into ~/.config/omarchy/plugins/
    Install {
        /// Overwrite an existing install
        #[arg(long)]
        force: bool,
    },
    /// Remove the bar widget from ~/.config/omarchy/plugins/
    Uninstall,
}

pub fn run(cmd: Cmd) -> Result<()> {
    let mut config = Config::load();
    match cmd {
        Cmd::Alias { id, name } => cmd_alias(&mut config, &id, name),
        Cmd::List { json, fast } => cmd_list(&config, json, fast),
        Cmd::Get { target, fast } => cmd_get(&config, &target, fast),
        Cmd::Set {
            target,
            value,
            no_cache,
        } => cmd_set(&config, &target, value, no_cache),
        Cmd::Shell { action } => match action {
            ShellCmd::Install { force } => crate::shell_plugin::install(force),
            ShellCmd::Uninstall => crate::shell_plugin::uninstall(),
        },
    }
}

/// Position of the monitor matching `target` — a 1-based number, an EDID id, or
/// a configured alias. Returns the index so the caller keeps the whole list,
/// which `set` needs in order to write the cache back intact.
fn resolve(monitors: &[Monitor], config: &Config, target: &str) -> Result<usize> {
    monitors
        .iter()
        .position(|m| {
            target.parse::<usize>().map(|n| m.index == n).unwrap_or(false)
                || m.id == target
                || config.alias_of(&m.id).map(|a| a == target).unwrap_or(false)
        })
        .ok_or_else(|| anyhow!("no monitor found for \"{target}\""))
}

/// The monitor list for a read-only command. `fast` prefers the cache and only
/// falls back to a scan when there is no cache to read.
fn monitors(fast: bool) -> Result<Vec<Monitor>> {
    if fast {
        if let Some(cached) = ddc::cached() {
            return Ok(cached);
        }
    }
    ddc::detect()
}

#[derive(Serialize)]
struct JsonMonitor<'a> {
    index: usize,
    id: &'a str,
    name: &'a str,
    alias: Option<&'a str>,
    brightness: u16,
    bus: &'a str,
}

fn cmd_list(config: &Config, json: bool, fast: bool) -> Result<()> {
    let monitors = monitors(fast)?;

    if json {
        let rows: Vec<JsonMonitor> = monitors
            .iter()
            .map(|m| JsonMonitor {
                index: m.index,
                id: &m.id,
                name: &m.name,
                alias: config.alias_of(&m.id).map(String::as_str),
                brightness: m.brightness,
                bus: &m.bus,
            })
            .collect();
        println!("{}", serde_json::to_string(&rows)?);
        return Ok(());
    }

    if monitors.is_empty() {
        println!("No DDC/CI monitors detected");
        return Ok(());
    }

    println!("{:<16}{:<22}{:<12}{}", "ID", "NAME", "ALIAS", "BRIGHTNESS");
    println!("{}", "-".repeat(60));
    for m in &monitors {
        let name = if m.name.chars().count() > 20 {
            format!("{}...", m.name.chars().take(17).collect::<String>())
        } else {
            m.name.clone()
        };
        let alias = config.alias_of(&m.id).map(String::as_str).unwrap_or("-");
        println!("{:<16}{:<22}{:<12}{}%", m.id, name, alias, m.brightness);
    }
    Ok(())
}

fn cmd_get(config: &Config, target: &str, fast: bool) -> Result<()> {
    let monitors = monitors(fast)?;
    let i = resolve(&monitors, config, target)?;
    println!("{}", monitors[i].brightness);
    Ok(())
}

fn cmd_set(config: &Config, target: &str, value: u16, no_cache: bool) -> Result<()> {
    if value > 100 {
        return Err(anyhow!("value must be between 0 and 100"));
    }

    // Fast path: resolve from the cache and write straight to the stored bus.
    // Only taken when the monitor still on that bus reports the id we cached,
    // so a hotplug that renumbered the buses can't send the write elsewhere.
    if !no_cache {
        if let Some(mut cached) = ddc::cached() {
            if let Ok(i) = resolve(&cached, config, target) {
                if ddc::bus_matches(&cached[i].bus, &cached[i].id) {
                    cached[i].set(value)?;
                    println!("{} brightness set to {value}", cached[i].name);
                    config::write_monitor_cache(&cached);
                    return Ok(());
                }
            }
        }
    }

    let mut monitors = ddc::detect()?;
    let i = resolve(&monitors, config, target)?;
    monitors[i].set(value)?;
    println!("{} brightness set to {value}", monitors[i].name);
    config::write_monitor_cache(&monitors);
    Ok(())
}

fn cmd_alias(config: &mut Config, id: &str, name: Option<String>) -> Result<()> {
    match name {
        None => {
            let existing = config
                .alias_of(id)
                .cloned()
                .ok_or_else(|| anyhow!("no alias set for {id}"))?;
            config.unset_alias(id);
            println!("removed alias \"{existing}\" for {id}");
        }
        Some(alias) => {
            config.set_alias(id, &alias);
            println!("alias \"{alias}\" set for {id}");
        }
    }
    Ok(())
}
