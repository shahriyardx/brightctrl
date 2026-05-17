import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export interface MonitorInfo {
  index: number
  name: string
  bus: string
}

export interface Monitor extends MonitorInfo {
  brightness: number
}

function ddcutil(args: string[], timeout = 8000): Promise<string> {
  return execFileAsync("ddcutil", args, {
    timeout,
    encoding: "utf-8",
  }).then((r) => r.stdout)
}

export async function checkDdcutil(): Promise<boolean> {
  try {
    await execFileAsync("which", ["ddcutil"])
    return true
  } catch {
    return false
  }
}

export async function detectMonitors(): Promise<MonitorInfo[]> {
  const stdout = await ddcutil(["detect", "--brief"], 15000)
  const monitors: MonitorInfo[] = []
  let current: Partial<MonitorInfo> | null = null

  for (const line of stdout.split("\n")) {
    const t = line.trim()
    if (t.startsWith("Display ")) {
      if (current?.index != null) monitors.push(current as MonitorInfo)
      const m = t.match(/Display\s+(\d+)/)
      current = {
        index: m ? Number.parseInt(m[1]!, 10) : monitors.length + 1,
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

export async function getBrightness(
  displayIndex: number,
): Promise<number | null> {
  try {
    const stdout = await ddcutil(
      ["getvcp", "10", `--display=${displayIndex}`],
      5000,
    )
    const m = stdout.match(/current value\s*=\s*(\d+)/)
    return m ? Number.parseInt(m[1]!, 10) : null
  } catch {
    return null
  }
}

export async function setBrightness(
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
