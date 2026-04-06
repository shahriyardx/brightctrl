# BrightCtrl

A lightweight DDC/CI monitor brightness controller for Linux, built with [Dear PyGui](https://github.com/hoffstadt/DearPyGui).

![Python](https://img.shields.io/badge/python-3.10%2B-blue)
![Platform](https://img.shields.io/badge/platform-Linux-lightgrey)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- Detects all DDC/CI-capable monitors automatically
- Per-monitor brightness sliders with live percentage readout
- **Sync mode** — control all monitors with a single master slider
- Debounced DDC writes (no flooding the i2c bus while dragging)
- Dark theme, monospace font auto-detection

## Requirements

### System

| Distro | Command |
|---|---|
| Arch / Manjaro | `sudo pacman -S ddcutil` |
| Debian / Ubuntu | `sudo apt install ddcutil` |
| Fedora / RHEL | `sudo dnf install ddcutil` |
| openSUSE | `sudo zypper install ddcutil` |

Then set up the i2c kernel module and add yourself to the i2c group:

```bash
sudo usermod -aG i2c $USER
sudo modprobe i2c-dev

# Persist across reboots:
echo 'i2c-dev' | sudo tee /etc/modules-load.d/i2c.conf

# Log out and back in for the group change to take effect.
```

Verify everything works before launching BrightCtrl:

```bash
ddcutil detect
```

### Python

- Python 3.10+
- [dearpygui](https://github.com/hoffstadt/DearPyGui)

```bash
pip install dearpygui
# or with uv:
uv add dearpygui
```

## Installation & Usage

```bash
git clone https://github.com/your-username/brightctrl.git
cd brightctrl
pip install dearpygui
python -m brightctrl
```

## Known Limitations

- **NVIDIA GPUs** — proprietary drivers often block the i2c bus; DDC/CI may not work.
- **USB-C / DisplayPort docks / KVMs** — DDC/CI passthrough is unreliable on some hardware.
- **Some monitors** do not implement DDC/CI even if they claim to.
- Tested on X11 and Wayland (KDE/GNOME); `ddcutil` operates at the kernel level so compositor choice rarely matters.

## License

MIT
