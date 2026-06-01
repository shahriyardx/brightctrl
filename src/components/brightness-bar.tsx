import { useOnResize } from "@opentui/react"
import { useRef, useState, useEffect, useCallback } from "react"

export function BrightnessBar({
  value,
  selected,
}: {
  value: number
  selected?: boolean
}) {
  const ref = useRef<any>(null)
  const [barWidth, setBarWidth] = useState(0)

  const measure = useCallback(() => {
    const box = ref.current
    if (!box) return
    const w = box.width ?? box.computedWidth ?? 0
    if (w > 0) {
      setBarWidth(Math.max(0, w))
    }
  }, [])

  useEffect(() => {
    let attempts = 0
    const poll = () => {
      const box = ref.current
      const w = box?.width ?? box?.computedWidth ?? 0
      if (w > 0) {
        measure()
      } else if (attempts++ < 10) {
        setTimeout(poll, 16)
      }
    }
    setTimeout(poll, 0)

    const box = ref.current
    if (box) {
      const orig = box.onResize?.bind(box)
      box.onResize = (w: number, h: number) => {
        orig?.(w, h)
        setBarWidth(Math.max(0, w))
      }
      return () => {
        box.onResize = orig
      }
    }
  }, [measure])

  useOnResize(() => setTimeout(measure, 0))

  const filled = barWidth > 0 ? Math.round((value / 100) * barWidth) : 0
  const empty = barWidth - filled

  return (
    <box ref={ref} flexGrow={1} width={"100%"}>
      <text>
        <span fg={selected ? "cyan" : "#444"}>
          {filled > 0 ? "▰".repeat(filled) : ""}
        </span>
        <span fg="#444">{empty > 0 ? "▱".repeat(empty) : ""}</span>
      </text>
    </box>
  )
}
