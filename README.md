# BrightCtrl

Adjust the brightness of your external monitors right from the terminal.

A single native binary — no `ddcutil`, no Node.js, no runtime deps. **Linux**
talks DDC/CI directly over i2c; **Windows** uses the Monitor Configuration API.

![Screenshot](assets/banner.png)

## Install

### npm / npx (Linux & Windows, x64)

```bash
npx brightctrl          # run without installing
npm i -g brightctrl     # or install globally
```

### Arch Linux (AUR)

```bash
yay -S brightctrl
```

### Prebuilt binary

```bash
# Linux
curl -L https://github.com/shahriyardx/brightctrl/releases/latest/download/brightctrl -o brightctrl
chmod +x brightctrl
sudo mv brightctrl /usr/local/bin/
```

Windows: download `brightctrl.exe` from the [latest release](https://github.com/shahriyardx/brightctrl/releases/latest) and run it from a terminal.

### From source

```bash
cargo install --git https://github.com/shahriyardx/brightctrl
```

## Setup (Linux)

DDC/CI needs the i2c kernel module and group access (one-time):

```bash
sudo modprobe i2c-dev
echo i2c-dev | sudo tee /etc/modules-load.d/i2c.conf   # load on boot
sudo usermod -aG i2c $USER                              # then log out and back in
```

On **Windows** no setup is needed — just enable DDC/CI in your monitor's OSD menu
if `list` comes up empty. Monitor names come from EDID; if Windows has no driver
for a display it may fall back to a generic name.

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
