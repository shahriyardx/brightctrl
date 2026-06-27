//! Headless commands: list / get / set / alias. Runs when args are present.

use anyhow::{anyhow, Result};
use clap::{Parser, Subcommand};

use crate::config::Config;
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
    List,
    /// Get brightness (0-100) for a monitor
    Get {
        /// Monitor number, id, or alias
        target: String,
    },
    /// Set brightness (0-100) for a monitor
    Set {
        /// Monitor number, id, or alias
        target: String,
        /// Brightness value 0-100
        value: u16,
    },
    /// Register or remove a human-friendly alias for a monitor id
    Alias {
        /// Monitor id (see `list`)
        id: String,
        /// Alias name; omit to remove the existing alias
        name: Option<String>,
    },
}

pub fn run(cmd: Cmd) -> Result<()> {
    let mut config = Config::load();
    match cmd {
        Cmd::Alias { id, name } => cmd_alias(&mut config, &id, name),
        Cmd::List => cmd_list(&config),
        Cmd::Get { target } => cmd_get(&target),
        Cmd::Set { target, value } => cmd_set(&target, value),
    }
}

fn resolve(monitors: Vec<Monitor>, config: &Config, target: &str) -> Result<Monitor> {
    let mut monitors = monitors;
    let pos = monitors.iter().position(|m| {
        target.parse::<usize>().map(|n| m.index == n).unwrap_or(false)
            || m.id == target
            || config.alias_of(&m.id).map(|a| a == target).unwrap_or(false)
    });
    match pos {
        Some(i) => Ok(monitors.swap_remove(i)),
        None => Err(anyhow!("no monitor found for \"{target}\"")),
    }
}

fn cmd_list(config: &Config) -> Result<()> {
    let monitors = ddc::detect()?;
    if monitors.is_empty() {
        println!("No DDC/CI monitors detected");
        return Ok(());
    }

    println!(
        "{:<16}{:<22}{:<12}{}",
        "ID", "NAME", "ALIAS", "BRIGHTNESS"
    );
    println!("{}", "-".repeat(60));
    for m in &monitors {
        let name = if m.name.chars().count() > 20 {
            format!("{}...", m.name.chars().take(17).collect::<String>())
        } else {
            m.name.clone()
        };
        let alias = config.alias_of(&m.id).map(String::as_str).unwrap_or("-");
        println!(
            "{:<16}{:<22}{:<12}{}%",
            m.id, name, alias, m.brightness
        );
    }
    Ok(())
}

fn cmd_get(target: &str) -> Result<()> {
    let config = Config::load();
    let monitor = resolve(ddc::detect()?, &config, target)?;
    println!("{}", monitor.brightness);
    Ok(())
}

fn cmd_set(target: &str, value: u16) -> Result<()> {
    if value > 100 {
        return Err(anyhow!("value must be between 0 and 100"));
    }
    let config = Config::load();
    let mut monitor = resolve(ddc::detect()?, &config, target)?;
    monitor.set(value)?;
    println!("{} brightness set to {value}", monitor.name);
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
