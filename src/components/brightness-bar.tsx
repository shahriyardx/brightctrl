import { Box, Text } from "ink"

export function BrightnessBar({
  value,
  width = 25,
}: {
  value: number
  width?: number
}) {
  const filled = Math.round((value / 100) * width)
  const empty = width - filled
  const color = value <= 20 ? "red" : value >= 90 ? "yellow" : "cyan"

  return (
    <Box>
      <Text color={color}>{filled > 0 ? "█".repeat(filled) : ""}</Text>
      <Text color="#444">{empty > 0 ? "░".repeat(empty) : ""}</Text>
      <Text> </Text>
      <Text color={color} bold>
        {Math.round(value)}%
      </Text>
    </Box>
  )
}
