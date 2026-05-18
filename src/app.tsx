import { Box, Text, useApp, useInput } from "ink"
import { useState } from "react"
import { MonitorCard } from "./components/monitor-card.js"
import { ErrorPanel } from "./components/error-panel.js"
import { useMonitors } from "./hooks/use-monitors.js"

export default function App() {
  const { exit } = useApp()
  const {
    monitors,
    selected,
    setSelected,
    syncMode,
    setSyncMode,
    preciseMode,
    setPreciseMode,
    step,
    adjustBrightness,
    setExactBrightness,
    status,
    error,
    loading,
    reload,
  } = useMonitors()
  const [typing, setTyping] = useState(false)
  const [typed, setTyped] = useState("")

  useInput((input, key) => {
    if (typing) {
      if (key.escape) {
        setTyping(false)
        setTyped("")
      } else if (key.return) {
        const v = Number.parseInt(typed, 10)
        if (!Number.isNaN(v)) setExactBrightness(v)
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
      adjustBrightness(-step)
    } else if (input === "l" || key.rightArrow) {
      adjustBrightness(step)
    } else if (input === "p") {
      setPreciseMode((s) => !s)
    } else if (input === "s") {
      setSyncMode((s) => !s)
    } else if (input === "r") {
      reload()
    } else if (input === "i") {
      setTyping(true)
      setTyped("")
    }
  })

  return (
    <Box flexDirection="column" padding={1}>
      <Box gap={2}>
        <Text bold color="cyan">
          BrightCtrl
        </Text>
        <Text color="gray">DDC/CI Brightness Controller</Text>
      </Box>
      <Text color="#333">{"─".repeat(56)}</Text>

      <Box marginBottom={1} gap={3}>
        <Text color={preciseMode ? "green" : "gray"}>
          [{preciseMode ? "✓" : " "}] Precise <Text color="gray">(p)</Text>
        </Text>
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

      <Box marginBottom={1}>
        {loading ? (
          <Text color="gray">{status}...</Text>
        ) : error ? (
          <Text color="red">{error}</Text>
        ) : (
          <Text color="gray">{status}</Text>
        )}
      </Box>

      {!loading && !error && monitors.length > 0 ? (
        <Box flexDirection="column" gap={0}>
          {monitors.map((m, i) => (
            <MonitorCard key={m.index} monitor={m} selected={i === selected} />
          ))}
        </Box>
      ) : null}

      {!loading && error ? <ErrorPanel /> : null}

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

      {!loading ? (
        <Box marginTop={1}>
          {error ? null : (
            <Text color="gray">
              ↑↓ select h/l ←→ brightness p precise i input s sync r refresh q quit
            </Text>
          )}
        </Box>
      ) : null}
    </Box>
  )
}
