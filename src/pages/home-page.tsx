import { useKeyboard, useRenderer } from "@opentui/react"
import { ErrorPanel } from "../components/error-panel"
import { MonitorCard } from "../components/monitor-card"
import { MonitorsTitle } from "../components/monitors-title"
import { useNavigation } from "../context/navigation-context"
import { useMonitors } from "../context/monitors-context"
import Header from "../components/header"
import { usePlatform } from "../hooks/use-platform"

export function HomePage() {
  const renderer = useRenderer()
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
    setTyping,
    typing,
    handleInputSubmit,
  } = useMonitors()
  const { os, isSupported } = usePlatform()

  useKeyboard((key) => {
    if (typing) {
      if (key.name === "escape" || key.name === "/") {
        setTyping(false)
      }
      return
    }

    if (key.name === "q") renderer.destroy()
    if (key.name === "?") {
      goHelp()
    } else if (key.name === "/") {
      if (monitors.length > 0) {
        setTyping(true)
      }
    } else if (/^[1-9]$/.test(key.name)) {
      const next = Number.parseInt(key.name, 10) - 1
      setSelected(Math.max(0, Math.min(monitors.length - 1, next)))
    } else if (key.name === "up" || key.name === "k") {
      setSelected((s) => Math.max(0, s - 1))
      setTyping(false)
    } else if (key.name === "down" || key.name === "j") {
      setTyping(false)
      setSelected((s) => Math.max(0, Math.min(monitors.length - 1, s + 1)))
    } else if (key.name === "h" || key.name === "left") {
      adjustBrightness(-step)
    } else if (key.name === "l" || key.name === "right") {
      adjustBrightness(step)
    } else if (key.name === "p") {
      setPreciseMode((s) => !s)
    } else if (key.name === "s") {
      setSyncMode((s) => {
        if (s) {
          setSelected(0)
        } else {
          setSelected(-1)
        }
        return !s
      })
    } else if (key.name === "r") {
      reload()
    } else if (key.name === "m") {
      setExactBrightness(0)
    }
  })

  return (
    <>
      <Header />
      <box flexDirection="column" paddingX={2}>
        {isSupported ? (
          <box flexDirection="column">
            <MonitorsTitle />

            {typing && syncMode && (
              <box borderStyle="single" borderColor="#29313a">
                <input
                  placeholder="Enter brightness 0-100"
                  focused
                  onSubmit={(e) => handleInputSubmit(String(e))}
                />
              </box>
            )}

            <box flexDirection="column">
              {loading && monitors.length === 0 ? (
                <box borderStyle="single" borderColor="#29313a">
                  <text fg="gray">{status}...</text>
                </box>
              ) : error && monitors.length === 0 ? (
                <box flexDirection="column">
                  <box borderStyle="single" borderColor="red">
                    <text fg="red">{error}</text>
                  </box>
                  <ErrorPanel />
                </box>
              ) : (
                <>
                  {error && (
                    <box
                      borderStyle="single"
                      borderColor="red"
                      marginBottom={1}
                    >
                      <text fg="red">{error}</text>
                    </box>
                  )}
                  {monitors.map((m, i) => (
                    <MonitorCard
                      key={m.index}
                      monitor={m}
                      selected={i === selected}
                      syncMode={syncMode}
                      position={i + 1}
                      alias={config.aliases[m.id]}
                    />
                  ))}
                </>
              )}
            </box>
          </box>
        ) : (
          <box flexDirection="column">
            <box borderStyle="single" borderColor="red" paddingX={1}>
              <text fg="red">{os} is not yet supported</text>
            </box>
          </box>
        )}
      </box>
    </>
  )
}
