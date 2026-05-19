import { Box, Text } from "ink"
import { useEffect, useState } from "react"
import { useMonitors } from "../context/monitors-context"

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

export function MonitorsTitle() {
  const { syncMode, preciseMode, loading } = useMonitors()
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    if (!loading) return
    const id = setInterval(() => setFrame((f) => (f + 1) % SPINNER.length), 80)
    return () => clearInterval(id)
  }, [loading])

  return (
    <Box marginBottom={1} alignItems="center" justifyContent="space-between">
      <Box>
        {loading && <Text color="cyan">{SPINNER[frame]} </Text>}
        <Text color="cyan" bold>
          MONITORS
        </Text>
      </Box>

      <Box flexShrink={0} justifyContent="flex-end" gap={1}>
        <Text color={"white"} backgroundColor={syncMode ? "green" : "gray"}>
          {" Sync"}
          <Text dimColor> (s) </Text>
        </Text>

        <Text color={"white"} backgroundColor={preciseMode ? "green" : "gray"}>
          {" Precise"}
          <Text dimColor> (p) </Text>
        </Text>
      </Box>
    </Box>
  )
}
