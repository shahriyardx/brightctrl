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

// ── macOS: Python + CoreGraphics ─────────────────────────────────────

const macPyScript = `import sys,json
from Quartz.CoreGraphics import *
c=sys.argv[1]
if c=='list':
 b=(CGDirectDisplayID*32)()
 n=CGDisplayCount()
 CGGetActiveDisplayList(32,b,n)
 d=[]
 for i in range(n.value):
  bi=CGDisplayGetBrightness(b[i])
  d.append({'index':i+1,'name':f'Display {b[i]}'})
 print(json.dumps(d))
elif c=='get':
 b=(CGDirectDisplayID*32)()
 n=CGDisplayCount()
 CGGetActiveDisplayList(32,b,n)
 print(round(CGDisplayGetBrightness(b[int(sys.argv[2])-1])*100))
elif c=='set':
 b=(CGDirectDisplayID*32)()
 n=CGDisplayCount()
 CGGetActiveDisplayList(32,b,n)
 CGDisplaySetBrightness(b[int(sys.argv[2])-1],int(sys.argv[3])/100.0)`

async function macPy(cmd: string): Promise<string> {
  const args = ["-c", macPyScript, ...cmd.split(" ")]
  const r = await execFileAsync("python3", args, {
    timeout: 5000,
    encoding: "utf-8",
  })
  return r.stdout.trim()
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
      await macPy("list")
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

// ── macOS: Python + CoreGraphics ──────────────────────────────────

async function detectMonitorsMac(): Promise<MonitorInfo[]> {
  const stdout = await macPy("list")
  if (!stdout) return []
  const data = JSON.parse(stdout)
  const arr = Array.isArray(data) ? data : [data]
  return arr.map((d: Record<string, unknown>, i: number) => ({
    index: i + 1,
    name: typeof d.name === "string" && d.name ? d.name : "Display",
    bus: "",
  }))
}

async function getBrightnessMac(displayIndex: number): Promise<number | null> {
  try {
    const stdout = await macPy(`get ${displayIndex}`)
    const v = Number.parseInt(stdout, 10)
    return Number.isNaN(v) ? null : v
  } catch {
    return null
  }
}

async function setBrightnessMac(
  displayIndex: number,
  value: number,
): Promise<boolean> {
  try {
    await macPy(`set ${displayIndex} ${Math.round(value)}`)
    return true
  } catch {
    return false
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
