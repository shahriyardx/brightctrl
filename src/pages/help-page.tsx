import { useKeyboard, useRenderer } from "@opentui/react"
import { ControlRow } from "../components/control-row"
import { useNavigation } from "../context/navigation-context"
import Footer from "../components/footer"
import Header from "../components/header"

export function HelpPage() {
  const renderer = useRenderer()
  const { goHome } = useNavigation()

  useKeyboard((key) => {
    if (key.name === "q") {
      renderer.destroy()
    } else if (
      key.name === "?" ||
      key.name === "escape" ||
      key.name === "return"
    ) {
      goHome()
    }
  })

  return (
    <>
      <Header />
      <box flexDirection="column" paddingX={2}>
        <box flexDirection="column">
          <box marginBottom={1}>
            <text fg="cyan">
              <b>CONTROLS</b>
            </text>
          </box>
          <box flexDirection="row" justifyContent="space-between">
            <box flexDirection="column" width={"50%"}>
              <ControlRow keys="↑ / k" label="Select previous monitor" />
              <ControlRow keys="↓ / j" label="Select next monitor" />
              <ControlRow keys="← / h" label="Decrease brightness" />
              <ControlRow keys="→ / l" label="Increase brightness" />
              <ControlRow keys="1 - 9" label="Select monitor by number" />
              <ControlRow keys="/" label="Enter brightness value (0-100)" />
            </box>
            <box flexDirection="column" width={"50%"}>
              <ControlRow keys="p" label="Toggle precise mode" />
              <ControlRow keys="s" label="Sync all monitors" />
              <ControlRow keys="r" label="Refresh monitor list" />
              <ControlRow keys="q" label="Quit" />
              <ControlRow keys="?" label="Return home" />
            </box>
          </box>
        </box>

        <Footer />
      </box>
    </>
  )
}
