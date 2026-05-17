import { Box, Text, useApp, useInput } from "ink"
import { useCallback, useEffect, useRef, useState } from "react"
import type { Monitor } from "./ddcutil.js"
import {
  checkDdcutil,
  detectMonitors,
  getBrightness,
  setBrightness,
} from "./ddcutil.js"

// ─── Brightness Bar ──────────────────────────────────────────────────

function BrightnessBar({
  value,
  width = 25,
}: {
  value: number
  width?: number
}) {
  const filled = Math.round((value / 100) * width)
  const empty = width - filled
  const color = value <= 20 ? "red" : value >= 90 ? "yellow" : "cyan"

  return (
    <Box>
      <Text color={color}>{filled > 0 ? "█".repeat(filled) : ""}</Text>
      <Text color="#444">{empty > 0 ? "░".repeat(empty) : ""}</Text>
      <Text> </Text>
      <Text color={color} bold>
        {Math.round(value)}%
      </Text>
    </Box>
  )
}

// ─── Monitor Card ────────────────────────────────────────────────────

function MonitorCard({
  monitor,
  selected,
}: {
  monitor: Monitor
  selected: boolean
}) {
  return (
    <Box
      borderStyle={selected ? "round" : "single"}
      borderColor={selected ? "cyan" : "gray"}
      flexDirection="column"
      paddingX={1}
      paddingY={0}
    >
      <Box gap={1}>
        <Text bold color={selected ? "cyan" : "white"}>
          Display {monitor.index}
        </Text>
        <Text color="white">{monitor.name}</Text>
        <Text color="gray">{monitor.bus}</Text>
        {selected ? <Text color="cyan">◄</Text> : null}
      </Box>
      <Box>
        <BrightnessBar value={monitor.brightness} />
      </Box>
    </Box>
  )
}

// ─── Error Panel ─────────────────────────────────────────────────────

function ErrorPanel() {
  const plat = process.platform
  if (plat === "darwin") return null

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color="yellow">Troubleshooting:</Text>
      {plat === "win32" ? (
        <>
          <Text color="gray">
            Some GPUs/monitors don't expose brightness via WMI.
          </Text>
          <Text color="gray">
            Try installing MonitorController from Windows Store.
          </Text>
        </>
      ) : (
        <>
          <Text color="gray"> sudo pacman -S ddcutil</Text>
          <Text color="gray"> sudo usermod -aG i2c $USER</Text>
          <Text color="gray"> sudo modprobe i2c-dev</Text>
          <Text color="gray">
            echo 'i2c-dev' | sudo tee /etc/modules-load.d/i2c.conf
          </Text>
          <Text color="gray"> (log out and in for group change)</Text>
        </>
      )}
    </Box>
  )
}

// ─── Main App ────────────────────────────────────────────────────────

export default function App() {
  const { exit } = useApp()
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [selected, setSelected] = useState(0)
  const [syncMode, setSyncMode] = useState(false)
  const [status, setStatus] = useState("Starting...")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [typing, setTyping] = useState(false)
  const [typed, setTyped] = useState("")
  // Debounce: wait 500ms after last keypress then fire ddcutil
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)
  const pendingRef = useRef<Map<number, number>>(new Map())

  function scheduleBrightness(index: number, value: number) {
    pendingRef.current.set(index, value)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      const vals = new Map(pendingRef.current)
      pendingRef.current.clear()
      for (const [idx, v] of vals) {
        setBrightness(idx, v)
      }
    }, 500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setStatus("Checking ddcutil...")

    const hasBackend = await checkDdcutil()
    if (!hasBackend) {
      if (process.platform === "win32") {
        setError("No monitors with WMI brightness control found")
      } else if (process.platform === "darwin") {
        setError("macOS is not supported at this moment")
      } else {
        setError("ddcutil not found. Install: sudo pacman -S ddcutil")
      }
      setStatus("backend unavailable")
      setLoading(false)
      return
    }

    setStatus("Detecting monitors...")
    const infoList = await detectMonitors()

    if (infoList.length === 0) {
      setError("No DDC/CI monitors detected")
      setStatus("No monitors found")
      setLoading(false)
      return
    }

    setStatus(`Reading brightness for ${infoList.length} monitor(s)...`)
    const loaded: Monitor[] = []
    for (const info of infoList) {
      const b = await getBrightness(info.index)
      loaded.push({ ...info, brightness: b ?? 50 })
    }

    setMonitors(loaded)
    setSelected((s) => Math.min(s, loaded.length - 1))
    setStatus(`${loaded.length} monitor(s) — DDC/CI via ddcutil`)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function adjustBrightness(delta: number) {
    if (monitors.length === 0) return
    const idx = selected

    setMonitors((prev) =>
      prev.map((m, i) => {
        if (!syncMode && i !== idx) return m
        const v = Math.max(0, Math.min(100, m.brightness + delta))
        scheduleBrightness(m.index, v)
        return { ...m, brightness: v }
      }),
    )
  }

  useInput((input, key) => {
    if (typing) {
      if (key.escape) {
        setTyping(false)
        setTyped("")
      } else if (key.return) {
        const v = Number.parseInt(typed, 10)
        if (!Number.isNaN(v) && v >= 0 && v <= 100) {
          setMonitors((prev) =>
            prev.map((m, i) => {
              if (!syncMode && i !== selected) return m
              scheduleBrightness(m.index, v)
              return { ...m, brightness: v }
            }),
          )
        }
        setTyping(false)
        setTyped("")
      } else if (key.backspace) {
        setTyped((p) => p.slice(0, -1))
      } else if (/^[0-9]$/.test(input)) {
        setTyped((p) => (p + input).slice(0, 3))
      }
      return
    }

    if (input === "q") exit()

    if (key.upArrow) {
      setSelected((s) => Math.max(0, s - 1))
    } else if (key.downArrow) {
      setSelected((s) => Math.min(monitors.length - 1, s + 1))
    } else if (input === "h" || key.leftArrow) {
      adjustBrightness(-5)
    } else if (input === "l" || key.rightArrow) {
      adjustBrightness(5)
    } else if (input === "s") {
      setSyncMode((s) => !s)
    } else if (input === "r") {
      load()
    } else if (input === "i") {
      setTyping(true)
      setTyped("")
    }
  })

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box gap={2}>
        <Text bold color="cyan">
          BrightCtrl
        </Text>
        <Text color="gray">DDC/CI Brightness Controller</Text>
      </Box>
      <Text color="#333">{"─".repeat(56)}</Text>

      {/* Toolbar */}
      <Box marginBottom={1} gap={3}>
        <Text color={syncMode ? "green" : "gray"}>
          [{syncMode ? "✓" : " "}] Sync All <Text color="gray">(s)</Text>
        </Text>
        <Text>
          ⟳ Refresh <Text color="gray">(r)</Text>
        </Text>
        <Text>
          ✕ Quit <Text color="gray">(q)</Text>
        </Text>
      </Box>

      {/* Status */}
      <Box marginBottom={1}>
        {loading ? (
          <Text color="gray">{status}...</Text>
        ) : error ? (
          <Text color="red">{error}</Text>
        ) : (
          <Text color="gray">{status}</Text>
        )}
      </Box>

      {/* Monitor Cards */}
      {!loading && !error && monitors.length > 0 ? (
        <Box flexDirection="column" gap={0}>
          {monitors.map((m, i) => (
            <MonitorCard key={m.index} monitor={m} selected={i === selected} />
          ))}
        </Box>
      ) : null}

      {!loading && error ? <ErrorPanel /> : null}

      {/* Brightness input dialog */}
      {typing ? (
        <Box flexDirection="column" marginTop={1} marginBottom={1}>
          <Box
            borderStyle="round"
            borderColor="cyan"
            paddingX={1}
            flexDirection="column"
          >
            <Box gap={1}>
              <Text bold color="cyan">
                Brightness:
              </Text>
              <Text bold color="white">
                {typed || "0"}_
              </Text>
            </Box>
            <Text color="gray">Enter 0-100 ↵ confirm ⎋ cancel</Text>
          </Box>
        </Box>
      ) : null}

      {/* Footer */}
      {!loading ? (
        <Box marginTop={1}>
          {error ? null : (
            <Text color="gray">
              ↑↓ select h/l ←→ brightness i input s sync r refresh q quit
            </Text>
          )}
        </Box>
      ) : null}
    </Box>
  )
}
