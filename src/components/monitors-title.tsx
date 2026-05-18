import { Box, Text } from "ink"
import { useMonitors } from "../context/monitors-context"

export function MonitorsTitle() {
  const { syncMode, preciseMode } = useMonitors()

  return (
    <Box marginBottom={1} alignItems="center" justifyContent="space-between">
      <Box>
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
