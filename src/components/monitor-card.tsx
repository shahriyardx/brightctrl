import { Box, Text } from "ink"
import type { Monitor } from "../ddcutil.js"
import { BrightnessBar } from "./brightness-bar.js"

export function MonitorCard({
  monitor,
  selected,
}: {
  monitor: Monitor
  selected: boolean
}) {
  return (
    <Box
      borderStyle={selected ? "round" : "single"}
      borderColor={selected ? "cyan" : "gray"}
      flexDirection="column"
      paddingX={1}
      paddingY={0}
    >
      <Box gap={1}>
        <Text bold color={selected ? "cyan" : "white"}>
          Display {monitor.index}
        </Text>
        <Text color="white">{monitor.name}</Text>
        <Text color="gray">{monitor.bus}</Text>
        {selected ? <Text color="cyan">◄</Text> : null}
      </Box>
      <Box>
        <BrightnessBar value={monitor.brightness} />
      </Box>
    </Box>
  )
}
