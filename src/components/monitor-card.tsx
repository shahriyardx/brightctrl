import { Box, Text } from "ink"
import type { Monitor } from "../ddcutil"
import { BrightnessBar } from "./brightness-bar"

export function MonitorCard({
  monitor,
  selected,
  position,
  alias,
}: {
  monitor: Monitor
  selected: boolean
  position: number
  alias?: string | null
}) {
  const accent = selected ? "cyan" : position % 3 === 1 ? "green" : "magenta"

  return (
    <Box
      borderStyle="single"
      borderColor={selected ? "cyan" : "#29313a"}
      paddingX={1}
      paddingY={1}
      marginBottom={0}
    >
      <Box width={49}>
        <Box width={4}>
          <Text color={accent} bold>
            {position}
          </Text>
        </Box>
        <Box flexDirection="column">
          <Text color={accent} bold>
            {alias ?? monitor.name}
          </Text>
          <Text color="gray">{monitor.bus || `Display ${monitor.index}`}</Text>
        </Box>
      </Box>
      <Box flexDirection="column" width={72}>
        <Text color={accent}>BRIGHTNESS</Text>
        <BrightnessBar
          value={monitor.brightness}
          color={accent}
          showValue={false}
        />
      </Box>
      <Box width={7} justifyContent="flex-end">
        <Text color={accent} bold>
          {Math.round(monitor.brightness)}%
        </Text>
      </Box>
    </Box>
  )
}
