import { Box, Text } from "ink"

export function BrightnessBar({
  value,
  width = 54,
  color,
  showValue = true,
}: {
  value: number
  width?: number
  color?: string
  showValue?: boolean
}) {
  const filled = Math.round((value / 100) * width)
  const empty = width - filled
  const barColor =
    color ?? (value <= 20 ? "red" : value >= 90 ? "yellow" : "cyan")

  return (
    <Box>
      <Text color={barColor}>{filled > 0 ? "▰".repeat(filled) : ""}</Text>
      <Text color="#444">{empty > 0 ? "▱".repeat(empty) : ""}</Text>
      {showValue ? (
        <>
          <Text> </Text>
          <Text color={barColor} bold>
            {Math.round(value)}%
          </Text>
        </>
      ) : null}
    </Box>
  )
}
