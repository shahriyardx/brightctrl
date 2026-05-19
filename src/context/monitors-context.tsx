import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import type { ReactNode } from "react"
import type { Monitor } from "../ddcutil"
import {
  checkDdcutil,
  detectMonitors,
  getBrightness,
  setBrightness,
} from "../ddcutil"
import {
  getConfig,
  readMonitorCache,
  writeMonitorCache,
  type BrightCtrlConfig,
} from "../config"
import { usePlatform } from "../hooks/use-platform"

type MonitorsContextValue = {
  monitors: Monitor[]
  selected: number
  setSelected: (n: number | ((n: number) => number)) => void
  syncMode: boolean
  setSyncMode: (n: boolean | ((n: boolean) => boolean)) => void
  preciseMode: boolean
  setPreciseMode: (n: boolean | ((n: boolean) => boolean)) => void
  step: number
  adjustBrightness: (delta: number) => void
  setExactBrightness: (value: number) => void
  status: string
  error: string | null
  loading: boolean
  lastRefresh: string | null
  reload: () => void
  config: BrightCtrlConfig
}

const MonitorsContext = createContext<MonitorsContextValue | null>(null)

export function MonitorsProvider({ children }: { children: ReactNode }) {
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [selected, setSelected] = useState(0)
  const [syncMode, setSyncMode] = useState(false)
  const [preciseMode, setPreciseMode] = useState(false)
  const [status, setStatus] = useState("Starting...")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<string | null>(null)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)
  const pendingRef = useRef<Map<number, number>>(new Map())
  const { os } = usePlatform()
  const [config] = useState(getConfig())

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

  const cachedRef = useRef(false)

  const load = useCallback(
    async (force = false) => {
      if (!force && cachedRef.current) return

      setError(null)
      setStatus("Checking ddcutil...")

      if (process.platform !== "linux") {
        setError(`${os} is not supported yet`)
        return
      }

      const hasBackend = await checkDdcutil()
      if (!hasBackend) {
        setError("ddcutil not found. Install: sudo pacman -S ddcutil")
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

      writeMonitorCache(loaded)
      setMonitors(loaded)
      setSelected((s) => Math.min(s, loaded.length - 1))
      setStatus(`${loaded.length} monitor(s) — DDC/CI via ddcutil`)
      setLastRefresh(new Date().toLocaleTimeString())
      setLoading(false)
    },
    [os],
  )

  const reload = useCallback(() => load(true), [load])

  const persistTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const cached = readMonitorCache()
    if (cached && cached.length > 0) {
      setMonitors(cached.map((m) => ({ ...m, brightness: m.brightness ?? 50 })))
      setLoading(false)
      setStatus("Ready")
      cachedRef.current = true
    }
    load()
  }, [load])

  useEffect(() => {
    if (monitors.length === 0) return
    if (persistTimer.current) clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(() => writeMonitorCache(monitors), 2000)
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current)
    }
  }, [monitors])

  const value = {
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
    lastRefresh,
    reload,
    config,
  }

  return (
    <MonitorsContext.Provider value={value}>
      {children}
    </MonitorsContext.Provider>
  )
}

export function useMonitors() {
  const context = useContext(MonitorsContext)
  if (!context) {
    throw new Error("useMonitors must be used inside MonitorsProvider")
  }
  return context
}
