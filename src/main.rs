mod cli;
mod config;
mod ddc;
mod shell_plugin;
mod tui;

use clap::Parser;

fn main() -> anyhow::Result<()> {
    let args = cli::Cli::parse();
    match args.command {
        Some(cmd) => {
            if let Err(e) = cli::run(cmd) {
                eprintln!("error: {e}");
                std::process::exit(1);
            }
            Ok(())
        }
        None => tui::run(),
    }
}
