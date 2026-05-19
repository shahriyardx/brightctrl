# BrightCtrl

A lightweight DDC/CI monitor brightness controller for Linux — a terminal UI built with [React](https://react.dev) / [Ink](https://github.com/vadimdemedes/ink) on [Bun](https://bun.sh).

![Platform](https://img.shields.io/badge/platform-Linux-lightgrey)

```
 BrightCtrl ─ DDC/CI Brightness Controller
 ────────────────────────────────────────────────────────
 [ ] Precise (p)   [ ] Sync All (s)   ⟳ Refresh (r)   ✕ Quit (q)

 2 monitor(s) — DDC/CI via ddcutil

 ╭─ Display 1 ──────────────────────────────────────────╮
 │ █████████████░░░░░░░░░░░░░░░ 50%                     │
 ╰──────────────────────────────────────────────────────╯
 ╭─ Display 2 ──────────────────────────────────────────╮
 │ █████████████░░░░░░░░░░░░░░░ 50%                     │
 ╰──────────────────────────────────────────────────────╯

 ↑↓ select  h/l ←→ brightness  p precise  s sync  r refresh  q quit
```

## Features

- Auto-detects all DDC/CI-capable monitors
- Per-monitor brightness bars with live percentage
- Arrow key / vim (`h`/`l`) brightness adjustment (5% steps)
- **Sync mode** (`s`) — control all monitors at once
- 500ms debounce on DDC writes (no flooding the i2c bus)
- Brightness-dependent color coding (red ≤20%, cyan 21-89%, yellow ≥90%)

## Requirements

### System

| Distro | Command |
|---|---|
| Arch / Manjaro | `sudo pacman -S ddcutil` |
| Debian / Ubuntu | `sudo apt install ddcutil` |
| Fedora / RHEL | `sudo dnf install ddcutil` |

Then set up the i2c kernel module and add yourself to the i2c group:

```bash
sudo usermod -aG i2c $USER
sudo modprobe i2c-dev

# Persist across reboots:
echo 'i2c-dev' | sudo tee /etc/modules-load.d/i2c.conf

# Log out and back in for the group change to take effect.
```

Verify everything works:

```bash
ddcutil detect
```

### Runtime

- [Node.js](https://nodejs.org) >= 18
- Or [Bun](https://bun.sh) 1.x (for development)

## Install & Run

### Quick — no install needed

```bash
npx brightctrl
```

### Global install

```bash
npm install -g brightctrl
brightctrl
```

### From source

```bash
git clone https://github.com/shahriyardx/brightctrl.git
cd brightctrl
bun install
bun src/index.tsx
```

### Controls

| Key | Action |
|---|---|
| `↑` / `↓` | Select monitor |
| `←` / `h` | Decrease brightness 5% |
| `→` / `l` | Increase brightness 5% |
| `s` | Toggle sync mode (all monitors) |
| `r` | Refresh monitor detection |
| `q` | Quit |

