import { Box, Text } from "ink"
import type { Monitor } from "../ddcutil"
import { BrightnessBar } from "./brightness-bar"

export function MonitorCard({
  monitor,
  selected,
  syncMode,
  position,
  alias,
  editing,
  editBuffer,
}: {
  monitor: Monitor
  selected: boolean
  syncMode: boolean
  position: number
  alias?: string | null
  editing?: boolean
  editBuffer?: string
}) {
  const accent = selected || syncMode ? "cyan" : "gray"

  return (
    <Box
      borderStyle="single"
      borderColor={accent}
      paddingX={1}
      paddingY={1}
      marginBottom={0}
    >
      <Box width={30}>
        <Box width={4}>
          <Text color={accent} bold>
            {position}
          </Text>
        </Box>
        <Box flexDirection="column">
          <Box>
            <Text color={accent} bold>
              {monitor.name}
            </Text>
            {alias && (
              <Text color="gray" dimColor>
                {" "}
                ({alias})
              </Text>
            )}
          </Box>
          <Text color="gray">{monitor.bus || `Display ${monitor.index}`}</Text>
        </Box>
      </Box>
      <Box flexDirection="column" flexGrow={1}>
        <Box justifyContent="space-between">
          <Text color={accent}>BRIGHTNESS</Text>
          <Box width={7} justifyContent="flex-end">
            {editing ? (
              <Text color="cyan" bold>
                {editBuffer || " "}
                <Text color="cyan">|</Text>
              </Text>
            ) : (
              <Text color={accent} bold>
                {Math.round(monitor.brightness)}%
              </Text>
            )}
          </Box>
        </Box>
        <BrightnessBar
          value={monitor.brightness}
          color={accent}
          showValue={false}
        />
      </Box>
    </Box>
  )
}
