# brightctrl

Lightweight DDC/CI external monitor brightness controller — **TUI + CLI**. Native Rust binary, no `ddcutil` dependency. Talks DDC/CI directly over `/dev/i2c-*`.

> **Linux only.** Brightness control rides on i2c (`/dev/i2c-*`), which exists only on Linux. The npm package refuses to install on other platforms.

## Run

```sh
npx brightctrl          # interactive TUI
npx brightctrl list     # list monitors
npx brightctrl get 1    # read brightness
npx brightctrl set 1 50 # set monitor 1 to 50%
```

Or install globally:

```sh
npm i -g brightctrl
brightctrl              # also: bctrl, bc
```

On install, a prebuilt binary is downloaded from the matching [GitHub release](https://github.com/shahriyardx/brightctrl/releases) (Linux/x64). Needs network access.

## TUI keys

| Key | Action |
|-----|--------|
| `↑ ↓` | select monitor |
| `← →` | adjust brightness |
| `g` / `0` | 100% / 0% |
| `S` | sync mode (all monitors together) |
| `P` | precise mode |
| `r` | refresh / re-detect |
| `/` | type an exact value |
| `?` | help |
| `q` | quit |

Mouse: drag / click / scroll the bar; click the Sync / Precise toggles.

## Permissions

Reading and writing brightness needs access to `/dev/i2c-*`. Add yourself to the `i2c` group (or run as root):

```sh
sudo usermod -aG i2c $USER   # then re-login
```

If `/dev/i2c-*` is missing, load the module: `sudo modprobe i2c-dev`.

## Other install methods

- **Arch / AUR:** `yay -S brightctrl`
- **Binary:** download from [Releases](https://github.com/shahriyardx/brightctrl/releases), `chmod +x`, drop in `$PATH`.

## License

MIT
