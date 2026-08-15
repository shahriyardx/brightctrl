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
    /// Set brightness for a monitor
    Set {
        /// Monitor number, id, alias, or `all`
        target: String,
        /// Absolute value (`60`) or a relative step (`+5`, `-5`)
        // Without this clap reads a leading `-` as the start of a flag, so
        // `set main -5` fails before it ever reaches the parser below.
        #[arg(allow_hyphen_values = true)]
        value: String,
        /// Always rescan the i2c bus instead of resolving from the cache
        #[arg(long)]
        no_cache: bool,
    },
    /// Emit a Waybar JSON object for a custom module
    Waybar,
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
        } => cmd_set(&config, &target, &value, no_cache),
        Cmd::Waybar => cmd_waybar(),
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

/// Which monitors a `set` applies to. `all` is its own target so scroll
/// bindings don't have to name every display.
fn targets(monitors: &[Monitor], config: &Config, target: &str) -> Result<Vec<usize>> {
    if target == "all" {
        if monitors.is_empty() {
            return Err(anyhow!("no monitors detected"));
        }
        return Ok((0..monitors.len()).collect());
    }
    Ok(vec![resolve(monitors, config, target)?])
}

/// Resolve a value spec against the monitor's current brightness. A leading
/// `+`/`-` steps from where it is; anything else is absolute. Always clamped,
/// so `-5` at 2% lands on 0 instead of failing.
fn resolve_value(spec: &str, current: u16) -> Result<u16> {
    let spec = spec.trim();
    let relative = spec.starts_with('+') || spec.starts_with('-');
    let n: i32 = spec
        .parse()
        .map_err(|_| anyhow!("invalid value \"{spec}\"; use 0-100, or +N / -N"))?;

    let next = if relative { current as i32 + n } else { n };
    if !relative && !(0..=100).contains(&n) {
        return Err(anyhow!("value must be between 0 and 100"));
    }
    Ok(next.clamp(0, 100) as u16)
}

fn apply(monitors: &mut [Monitor], indices: &[usize], spec: &str) -> Result<()> {
    for &i in indices {
        let value = resolve_value(spec, monitors[i].brightness)?;
        monitors[i].set(value)?;
        println!("{} brightness set to {value}", monitors[i].name);
    }
    Ok(())
}

fn cmd_set(config: &Config, target: &str, value: &str, no_cache: bool) -> Result<()> {
    // Fast path: resolve from the cache and write straight to the stored bus.
    // Only taken when the monitor still on that bus reports the id we cached,
    // so a hotplug that renumbered the buses can't send the write elsewhere.
    if !no_cache {
        if let Some(mut cached) = ddc::cached() {
            if let Ok(indices) = targets(&cached, config, target) {
                if indices
                    .iter()
                    .all(|&i| ddc::bus_matches(&cached[i].bus, &cached[i].id))
                {
                    apply(&mut cached, &indices, value)?;
                    config::write_monitor_cache(&cached);
                    return Ok(());
                }
            }
        }
    }

    let mut monitors = ddc::detect()?;
    let indices = targets(&monitors, config, target)?;
    apply(&mut monitors, &indices, value)?;
    config::write_monitor_cache(&monitors);
    Ok(())
}

/// One JSON object on stdout for a Waybar `custom/*` module with
/// `"return-type": "json"`. Reads the cache, so it is cheap enough to poll.
///
/// Deliberately shows model names, not aliases: an alias is a handle for
/// typing at the CLI, not a label for a display.
fn cmd_waybar() -> Result<()> {
    let monitors = match ddc::cached() {
        Some(m) => m,
        None => ddc::detect().unwrap_or_default(),
    };

    if monitors.is_empty() {
        println!(
            "{}",
            serde_json::json!({
                "text": "\u{f00df} --",
                "tooltip": "No DDC/CI monitors detected",
                "class": "disconnected",
            })
        );
        return Ok(());
    }

    let top = monitors.iter().map(|m| m.brightness).max().unwrap_or(0);
    let icon = match top {
        66..=100 => "\u{f00e0}",
        33..=65 => "\u{f00df}",
        _ => "\u{f00de}",
    };
    let tooltip = monitors
        .iter()
        .map(|m| format!("{}: {}%", m.name, m.brightness))
        .collect::<Vec<_>>()
        .join("\n");

    println!(
        "{}",
        serde_json::json!({
            "text": format!("{icon} {top}%"),
            "tooltip": tooltip,
            "class": "connected",
        })
    );
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
