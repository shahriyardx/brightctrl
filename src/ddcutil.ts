import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const isWindows = process.platform === "win32"
const isMac = process.platform === "darwin"

export interface MonitorInfo {
  index: number
  name: string
  bus: string
}

export interface Monitor extends MonitorInfo {
  brightness: number
}

// ── Linux: ddcutil ──────────────────────────────────────────────────

function ddcutil(args: string[], timeout = 8000): Promise<string> {
  return execFileAsync("ddcutil", args, {
    timeout,
    encoding: "utf-8",
  }).then((r) => r.stdout)
}

// ── Windows: PowerShell + WMI ───────────────────────────────────────

function powerShell(script: string, timeout = 8000): Promise<string> {
  return execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    { timeout, encoding: "utf-8" },
  ).then((r) => r.stdout.trim())
}

// ── macOS: brightness CLI ───────────────────────────────────────────

function brightnessCLI(
  args: string[],
  timeout = 5000,
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync("brightness", args, {
    timeout,
    encoding: "utf-8",
  }).then((r) => ({ stdout: r.stdout.trim(), stderr: r.stderr.trim() }))
}

// ── Backend check ───────────────────────────────────────────────────

export async function checkDdcutil(): Promise<boolean> {
  if (isWindows) {
    try {
      const out = await powerShell(
        "Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness | ConvertTo-Json -Depth 3",
        5000,
      )
      return out.length > 0 && out !== "null"
    } catch {
      return false
    }
  }
  if (isMac) {
    try {
      await execFileAsync("which", ["brightness"])
      return true
    } catch {
      return false
    }
  }
  try {
    await execFileAsync("which", ["ddcutil"])
    return true
  } catch {
    return false
  }
}

// ── Monitor detection ───────────────────────────────────────────────

async function detectMonitorsLinux(): Promise<MonitorInfo[]> {
  const stdout = await ddcutil(["detect", "--brief"], 15000)
  const monitors: MonitorInfo[] = []
  let current: Partial<MonitorInfo> | null = null

  for (const line of stdout.split("\n")) {
    const t = line.trim()
    if (t.startsWith("Display ")) {
      if (current?.index != null) monitors.push(current as MonitorInfo)
      const m = t.match(/Display\s+(\d+)/)
      const idxStr = m?.[1]
      current = {
        index: idxStr ? Number.parseInt(idxStr, 10) : monitors.length + 1,
        name: "Unknown Monitor",
        bus: "",
      }
    } else if (t.includes("I2C bus:")) {
      if (current) current.bus = t.replace("I2C bus:", "").trim()
    } else if (t.startsWith("Monitor:")) {
      if (current) {
        const p = t.replace("Monitor:", "").trim()
        current.name = p.replace(/\s+unspecified/i, "").trim() || "Monitor"
      }
    }
  }
  if (current?.index != null) monitors.push(current as MonitorInfo)
  return monitors
}

async function detectMonitorsWindows(): Promise<MonitorInfo[]> {
  const ps = `$b=Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness; $r=@(); $i=0; foreach($m in $b){$i++; $r+=[PSCustomObject]@{index=$i;name=[string]($m.InstanceName -replace '.*\\\\([^\\\\]+)\\\\.*','$1');bus=$m.InstanceName}}; $r | ConvertTo-Json -Depth 3`
  const stdout = await powerShell(ps, 10000)
  if (!stdout || stdout === "null") return []
  const data = JSON.parse(stdout)
  const arr = Array.isArray(data) ? data : [data]
  return arr.map((d: Record<string, unknown>, i: number) => ({
    index: i + 1,
    name: typeof d.name === "string" && d.name ? d.name : "Monitor",
    bus: typeof d.bus === "string" ? d.bus : "",
  }))
}

// ── macOS: brightness CLI ──────────────────────────────────────────

async function detectMonitorsMac(): Promise<MonitorInfo[]> {
  const { stdout } = await brightnessCLI(["-l"])
  if (!stdout) return []

  const lines = stdout.split("\n")
  const monitors: MonitorInfo[] = []

  for (const line of lines) {
    const m = line.match(/^display\s+(\d+):/)
    if (m) {
      const cliIdx = Number.parseInt(m[1] as string, 10)
      const isMain = line.includes("main;")
      monitors.push({
        index: cliIdx + 1,
        name: isMain ? "Built-in Display" : "Display",
        bus: `display ${cliIdx}`,
      })
    }
  }

  // Single display — raw brightness number, no display prefix
  if (monitors.length === 0 && stdout.length > 0) {
    monitors.push({ index: 1, name: "Built-in Display", bus: "display 0" })
  }

  return monitors
}

async function getBrightnessMac(displayIndex: number): Promise<number | null> {
  try {
    const cliIdx = displayIndex - 1
    const { stdout } = await brightnessCLI(["-l"])
    if (!stdout) return null

    const targetLine = stdout
      .split("\n")
      .find((l) => l.startsWith(`display ${cliIdx}:`))
    if (targetLine) {
      const m = targetLine.match(/brightness\s+([\d.]+)/)
      if (m) return Math.round(Number.parseFloat(m[1] as string) * 100)
    }

    // Single display — output is just a float
    const v = Number.parseFloat(stdout)
    return Number.isNaN(v) ? null : Math.round(v * 100)
  } catch {
    return null
  }
}

async function setBrightnessMac(
  displayIndex: number,
  value: number,
): Promise<boolean> {
  const level = Math.round(value) / 100

  // Try per-display first, fall back to global set
  try {
    const cliIdx = displayIndex - 1
    await brightnessCLI(["-d", String(cliIdx), String(level)])
    return true
  } catch {
    // Per-display failed — try global (sets all displays)
    try {
      await brightnessCLI([String(level)])
      return true
    } catch {
      return false
    }
  }
}

export async function detectMonitors(): Promise<MonitorInfo[]> {
  if (isWindows) return detectMonitorsWindows()
  if (isMac) return detectMonitorsMac()
  return detectMonitorsLinux()
}

// ── Get brightness ──────────────────────────────────────────────────

async function getBrightnessLinux(
  displayIndex: number,
): Promise<number | null> {
  try {
    const stdout = await ddcutil(
      ["getvcp", "10", `--display=${displayIndex}`],
      5000,
    )
    const m = stdout.match(/current value\s*=\s*(\d+)/)
    const val = m?.[1]
    return val ? Number.parseInt(val, 10) : null
  } catch {
    return null
  }
}

async function getBrightnessWindows(
  displayIndex: number,
): Promise<number | null> {
  try {
    const idx = Math.max(0, displayIndex - 1)
    const ps = `$b=Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness; if($b -and $b.Count -ge ${idx + 1}){$b[${idx}].CurrentBrightness}else{-1}`
    const stdout = await powerShell(ps, 5000)
    const v = Number.parseInt(stdout, 10)
    return Number.isNaN(v) || v < 0 ? null : v
  } catch {
    return null
  }
}

export async function getBrightness(
  displayIndex: number,
): Promise<number | null> {
  if (isWindows) return getBrightnessWindows(displayIndex)
  if (isMac) return getBrightnessMac(displayIndex)
  return getBrightnessLinux(displayIndex)
}

// ── Set brightness ──────────────────────────────────────────────────

async function setBrightnessLinux(
  displayIndex: number,
  value: number,
): Promise<boolean> {
  try {
    await ddcutil(
      ["setvcp", "10", String(Math.round(value)), `--display=${displayIndex}`],
      5000,
    )
    return true
  } catch {
    return false
  }
}

async function setBrightnessWindows(
  displayIndex: number,
  value: number,
): Promise<boolean> {
  try {
    const idx = Math.max(0, displayIndex - 1)
    const ps = `$m=Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods; if($m -and $m.Count -ge ${idx + 1}){$m[${idx}].WmiSetBrightness(1,${Math.round(value)})}`
    await powerShell(ps, 5000)
    return true
  } catch {
    return false
  }
}

export async function setBrightness(
  displayIndex: number,
  value: number,
): Promise<boolean> {
  if (isWindows) return setBrightnessWindows(displayIndex, value)
  if (isMac) return setBrightnessMac(displayIndex, value)
  return setBrightnessLinux(displayIndex, value)
}
