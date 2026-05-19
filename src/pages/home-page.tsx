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
    syncMode,
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
  const [inputMode, setInputMode] = useState(false)
  const [editBuffer, setEditBuffer] = useState("")

  useInput((input, key) => {
    if (inputMode) {
      if (key.return) {
        const val = Number.parseInt(editBuffer, 10)
        if (!Number.isNaN(val)) {
          setExactBrightness(Math.max(0, Math.min(100, val)))
        }
        setInputMode(false)
        setEditBuffer("")
      } else if (key.escape || input === "/") {
        setInputMode(false)
        setEditBuffer("")
      } else if (key.backspace || key.delete) {
        setEditBuffer((s) => s.slice(0, -1))
      } else if (/^[0-9]$/.test(input) && editBuffer.length < 3) {
        setEditBuffer((s) => s + input)
      }
      return
    }

    if (input === "q") exit()

    if (input === "?") {
      goHelp()
    } else if (input === "/") {
      if (monitors.length > 0) {
        setInputMode(true)
        setEditBuffer("")
      }
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
              {loading && monitors.length === 0 ? (
                <Box borderStyle="single" borderColor="#29313a">
                  <Text color="gray">{status}...</Text>
                </Box>
              ) : error && monitors.length === 0 ? (
                <Box flexDirection="column">
                  <Box borderStyle="single" borderColor="red">
                    <Text color="red">{error}</Text>
                  </Box>
                  <ErrorPanel />
                </Box>
              ) : (
                <>
                  {error && (
                    <Box
                      borderStyle="single"
                      borderColor="red"
                      marginBottom={1}
                    >
                      <Text color="red">{error}</Text>
                    </Box>
                  )}
                  {monitors.map((m, i) => (
                    <MonitorCard
                      key={m.index}
                      monitor={m}
                      selected={i === selected}
                      syncMode={syncMode}
                      position={i + 1}
                      alias={config.aliases[m.id]}
                      editing={inputMode && i === selected}
                      editBuffer={editBuffer}
                    />
                  ))}
                </>
              )}
            </Box>
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
