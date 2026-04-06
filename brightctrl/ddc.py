import re
import subprocess


def run_ddcutil(*args, timeout=8):
    """Run a ddcutil command and return (stdout, stderr, returncode)."""
    try:
        r = subprocess.run(
            ["ddcutil"] + list(args),
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return r.stdout, r.stderr, r.returncode
    except FileNotFoundError:
        return (
            "",
            "ddcutil not found. Install it with your package manager (e.g. sudo pacman -S ddcutil)",
            1,
        )
    except subprocess.TimeoutExpired:
        return "", "ddcutil timed out", 1


def detect_monitors():
    """
    Return (monitors, error_string).
    Each monitor is a dict with keys: index, name, bus.
    """
    stdout, stderr, rc = run_ddcutil("detect", "--brief", timeout=12)
    monitors = []
    if rc != 0:
        return monitors, stderr.strip()

    current: dict = {}
    for line in stdout.splitlines():
        line = line.strip()
        if line.startswith("Display"):
            if current.get("bus"):
                monitors.append(current)
            m = re.match(r"Display\s+(\d+)", line)
            current = {
                "index": int(m.group(1)) if m else len(monitors) + 1,
                "name": "Unknown Monitor",
                "bus": None,
            }
        elif "I2C bus:" in line:
            m = re.search(r"I2C bus:\s+(.+)", line)
            if m:
                current["bus"] = m.group(1).strip()
        elif "Monitor:" in line:
            m = re.search(r"Monitor:\s+(.+)", line)
            if m:
                parts = [
                    p
                    for p in m.group(1).strip().split()
                    if p and p.lower() != "unspecified"
                ]
                current["name"] = " ".join(parts[:4]) if parts else "Monitor"

    if current.get("bus"):
        monitors.append(current)

    return monitors, stderr.strip()


def get_brightness(display_index):
    """Return current brightness (0-100) for the given display, or None on failure."""
    stdout, _, rc = run_ddcutil("getvcp", "10", f"--display={display_index}")
    if rc != 0:
        return None
    m = re.search(r"current value\s*=\s*(\d+)", stdout)
    return int(m.group(1)) if m else None


def set_brightness(display_index, value):
    """Set brightness (0-100) for the given display."""
    run_ddcutil("setvcp", "10", str(int(round(value))), f"--display={display_index}")
