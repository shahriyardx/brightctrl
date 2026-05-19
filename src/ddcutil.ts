import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export interface MonitorInfo {
  index: number
  name: string
  bus: string
  id: string
}

export interface Monitor extends MonitorInfo {
  brightness: number
}

function ddcutil(args: string[], timeout = 8000): Promise<string> {
  return execFileAsync("ddcutil", args, {
    timeout,
    encoding: "utf-8",
  }).then((r: { stdout: string }) => r.stdout)
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
  const stdout = await ddcutil(["detect"], 15000)
  const monitors: MonitorInfo[] = []
  let current: Partial<MonitorInfo> | null = null
  let inEdid = false

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
        id: "",
      }
      inEdid = false
    } else if (t.includes("I2C bus:")) {
      if (current) {
        current.bus = t.replace("I2C bus:", "").trim()
        current.id = current.bus.replace("/dev/", "")
      }
      inEdid = false
    } else if (t === "EDID synopsis:") {
      inEdid = true
    } else if (inEdid) {
      if (t.startsWith("Model:")) {
        if (current) {
          current.name = t.replace("Model:", "").trim() || "Monitor"
        }
      } else if (t.startsWith("Serial number:") && current) {
        const serial = t.replace("Serial number:", "").trim()
        if (serial) {
          current.id = serial.replace(/\s+/g, "_")
        }
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
    const val = m?.[1]
    return val ? Number.parseInt(val, 10) : null
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
