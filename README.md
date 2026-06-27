# BrightCtrl

Adjust the brightness of your external monitors right from the terminal.

A single static binary — no `ddcutil`, no Node.js, no runtime deps. Talks DDC/CI
to your monitors directly over i2c.

![Screenshot](assets/banner.png)

## Install

### Arch Linux (AUR)

```bash
yay -S brightctrl
```

### Prebuilt binary

```bash
curl -L https://github.com/shahriyardx/brightctrl/releases/latest/download/brightctrl -o brightctrl
chmod +x brightctrl
sudo mv brightctrl /usr/local/bin/
```

### From source

```bash
cargo install --git https://github.com/shahriyardx/brightctrl
```

## Setup

DDC/CI needs the i2c kernel module and group access (one-time):

```bash
sudo modprobe i2c-dev
echo i2c-dev | sudo tee /etc/modules-load.d/i2c.conf   # load on boot
sudo usermod -aG i2c $USER                              # then log out and back in
```

## TUI

Run `brightctrl` with no arguments.

| Key | Action |
|---|---|
| `↑` `↓` / `k` `j` | Pick a monitor |
| `←` `→` / `h` `l` | Brightness down / up |
| `1`–`9` | Select monitor by number |
| `/` | Type an exact value (0-100) |
| `p` | Precise mode — 1% steps instead of 5% |
| `s` | Sync — adjust all monitors at once |
| `m` | Set brightness to 0 |
| `r` | Refresh monitor list |
| `?` | Help |
| `q` | Quit |

## CLI

```bash
brightctrl list                 # detected monitors with ids, aliases, brightness
brightctrl get <target>         # print brightness (0-100)
brightctrl set <target> <0-100> # set brightness
brightctrl alias <id> <name>    # name a monitor for easier targeting
brightctrl alias <id>           # remove the alias
```

`<target>` is a monitor number (`1`), its id (`GSM7707`), or an alias (`left`).

Config and aliases live at `~/.config/brightctrl/config.toml`.
