import { useEffect, useState } from "react"
import { useMonitors } from "../context/monitors-context"

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

export function MonitorsTitle() {
  const { syncMode, setSyncMode, preciseMode, setPreciseMode, loading } =
    useMonitors()
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    if (!loading) return
    const id = setInterval(() => setFrame((f) => (f + 1) % SPINNER.length), 80)
    return () => clearInterval(id)
  }, [loading])

  return (
    <box
      flexDirection="row"
      marginBottom={1}
      alignItems="center"
      justifyContent="space-between"
      width={"100%"}
    >
      <box flexDirection="row">
        {loading && <text fg="cyan">{SPINNER[frame]} </text>}
        <text fg="cyan">
          <b>MONITORS</b>
        </text>
      </box>

      <box flexDirection="row" justifyContent="flex-end" gap={1}>
        <box
          onMouseDown={() => setSyncMode((p) => !p)}
          flexDirection="row"
          backgroundColor={syncMode ? "green" : "gray"}
          gap={1}
          paddingX={1}
        >
          <text>Sync</text>
          <text>(s)</text>
        </box>
        <box
          flexDirection="row"
          onMouseDown={() => setPreciseMode((p) => !p)}
          backgroundColor={preciseMode ? "green" : "gray"}
          gap={1}
          paddingX={1}
        >
          <text>Precise</text>
          <text>(p)</text>
        </box>
      </box>
    </box>
  )
}
