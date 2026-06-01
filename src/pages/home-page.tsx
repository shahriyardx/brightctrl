import { useKeyboard, useRenderer } from "@opentui/react"
import { useNavigation } from "../context/navigation-context"
import { useMonitors } from "../context/monitors-context"
import Header from "../components/header"
import { Supported } from "../components/supported"
import { NotSupported } from "../components/not-supported"
import { BrightnessInput } from "../components/brightness-input"
import { MonitorsPanel } from "../components/monitors-panel"

export function HomePage() {
  const renderer = useRenderer()
  const { goHelp } = useNavigation()
  const {
    monitors,
    setSelected,
    setSyncMode,
    setPreciseMode,
    step,
    adjustBrightness,
    setExactBrightness,
    reload,
    setTyping,
    typing,
  } = useMonitors()

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
        <Supported>
          <NotSupported />
          <BrightnessInput />
          <MonitorsPanel />
        </Supported>
      </box>
    </>
  )
}
