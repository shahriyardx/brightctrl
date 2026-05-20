import { Box, Text, measureElement, useStdout } from "ink"
import { useRef, useState, useEffect, useCallback } from "react"

export function BrightnessBar({
  value,
  color,
  showValue = true,
}: {
  value: number
  color?: string
  showValue?: boolean
}) {
  const ref = useRef<any>(null)
  const [barWidth, setBarWidth] = useState(0)
  const { stdout } = useStdout()

  const measure = useCallback(() => {
    if (ref.current) {
      const { width } = measureElement(ref.current)
      const labelWidth = showValue ? 5 : 0
      setBarWidth(Math.max(0, width - labelWidth))
    }
  }, [showValue])

  useEffect(() => {
    measure()
    stdout?.on("resize", measure)
    return () => {
      stdout?.off("resize", measure)
    }
  }, [measure, stdout])

  const filled = Math.round((value / 100) * barWidth)
  const empty = barWidth - filled
  const barColor =
    color ?? (value <= 20 ? "red" : value >= 90 ? "yellow" : "cyan")

  return (
    <Box ref={ref} flexGrow={1}>
      <Text color={barColor}>{filled > 0 ? "▰".repeat(filled) : ""}</Text>
      <Text color="#444">{empty > 0 ? "▱".repeat(empty) : ""}</Text>
      {showValue ? (
        <>
          <Text> </Text>
          <Text color={barColor} bold>
            {String(Math.round(value)).padStart(3)}%
          </Text>
        </>
      ) : null}
    </Box>
  )
}
