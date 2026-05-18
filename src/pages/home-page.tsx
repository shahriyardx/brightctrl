import { Box, Text, useApp, useInput } from "ink"
import { useState } from "react"
import { ErrorPanel } from "../components/error-panel"
import { MonitorCard } from "../components/monitor-card"
import { MonitorsTitle } from "../components/monitors-title"
import { useNavigation } from "../context/navigation-context"
import { useMonitors } from "../context/monitors-context"
import Header from "../components/header"
import { usePlatform } from "../hooks/use-platform"

export function HomePage() {
  const { exit } = useApp()
  const { goHelp } = useNavigation()
  const {
    monitors,
    selected,
    setSelected,
    setSyncMode,
    setPreciseMode,
    step,
    adjustBrightness,
    setExactBrightness,
    status,
    error,
    loading,
    reload,
    config,
  } = useMonitors()
  const { os, isSupported } = usePlatform()
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

    if (input === "?") {
      goHelp()
    } else if (/^[1-9]$/.test(input)) {
      const next = Number.parseInt(input, 10) - 1
      setSelected(Math.max(0, Math.min(monitors.length - 1, next)))
    } else if (key.upArrow || input === "k") {
      setSelected((s) => Math.max(0, s - 1))
    } else if (key.downArrow || input === "j") {
      setSelected((s) => Math.max(0, Math.min(monitors.length - 1, s + 1)))
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
    } else if (input === "m") {
      setExactBrightness(0)
    }
  })

  return (
    <>
      <Header />
      <Box flexDirection="column" paddingX={2}>
        {isSupported ? (
          <Box flexDirection="column">
            <MonitorsTitle />

            <Box flexDirection="column">
              {loading ? (
                <Box borderStyle="single" borderColor="#29313a">
                  <Text color="gray">{status}...</Text>
                </Box>
              ) : error ? (
                <Box flexDirection="column">
                  <Box borderStyle="single" borderColor="red">
                    <Text color="red">{error}</Text>
                  </Box>
                  <ErrorPanel />
                </Box>
              ) : (
                monitors.map((m, i) => (
                  <MonitorCard
                    key={m.index}
                    monitor={m}
                    selected={i === selected}
                    position={i + 1}
                    alias={config.aliases[m.id]}
                  />
                ))
              )}
            </Box>

            {typing ? (
              <Box flexDirection="column" marginTop={1} marginBottom={1}>
                <Box
                  borderStyle="single"
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
          </Box>
        ) : (
          <Box flexDirection="column">
            <Box borderStyle="single" borderColor="red" paddingX={1}>
              <Text color="red">{os} is not yet supported</Text>
            </Box>
          </Box>
        )}
      </Box>
    </>
  )
}
