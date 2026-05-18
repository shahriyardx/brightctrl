import { useCallback, useEffect, useRef, useState } from "react"
import type { Monitor } from "../ddcutil.js"
import {
  checkDdcutil,
  detectMonitors,
  getBrightness,
  setBrightness,
} from "../ddcutil.js"

export function useMonitors() {
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [selected, setSelected] = useState(0)
  const [syncMode, setSyncMode] = useState(false)
  const [preciseMode, setPreciseMode] = useState(false)
  const [status, setStatus] = useState("Starting...")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)
  const pendingRef = useRef<Map<number, number>>(new Map())

  function scheduleBrightness(index: number, value: number) {
    pendingRef.current.set(index, value)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      const vals = new Map(pendingRef.current)
      pendingRef.current.clear()
      for (const [idx, v] of vals) {
        setBrightness(idx, v)
      }
    }, 500)
  }

  const step = preciseMode ? 1 : 5

  function adjustBrightness(delta: number) {
    if (monitors.length === 0) return
    const idx = selected

    setMonitors((prev) =>
      prev.map((m, i) => {
        if (!syncMode && i !== idx) return m
        const v = Math.max(0, Math.min(100, m.brightness + delta))
        scheduleBrightness(m.index, v)
        return { ...m, brightness: v }
      }),
    )
  }

  function setExactBrightness(value: number) {
    if (monitors.length === 0) return
    const v = Math.max(0, Math.min(100, value))

    setMonitors((prev) =>
      prev.map((m, i) => {
        if (!syncMode && i !== selected) return m
        scheduleBrightness(m.index, v)
        return { ...m, brightness: v }
      }),
    )
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setStatus("Checking ddcutil...")

    const hasBackend = await checkDdcutil()
    if (!hasBackend) {
      if (process.platform === "win32") {
        setError("Windows is not supported at this moment")
      } else if (process.platform === "darwin") {
        setError("macOS is not supported at this moment")
      } else {
        setError("ddcutil not found. Install: sudo pacman -S ddcutil")
      }
      setStatus("backend unavailable")
      setLoading(false)
      return
    }

    setStatus("Detecting monitors...")
    const infoList = await detectMonitors()

    if (infoList.length === 0) {
      setError("No DDC/CI monitors detected")
      setStatus("No monitors found")
      setLoading(false)
      return
    }

    setStatus(`Reading brightness for ${infoList.length} monitor(s)...`)
    const loaded: Monitor[] = []
    for (const info of infoList) {
      const b = await getBrightness(info.index)
      loaded.push({ ...info, brightness: b ?? 50 })
    }

    setMonitors(loaded)
    setSelected((s) => Math.min(s, loaded.length - 1))
    setStatus(`${loaded.length} monitor(s) — DDC/CI via ddcutil`)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return {
    monitors,
    selected,
    setSelected,
    syncMode,
    setSyncMode,
    preciseMode,
    setPreciseMode,
    step,
    adjustBrightness,
    setExactBrightness,
    status,
    error,
    loading,
    reload: load,
  }
}
