import { useEffect, useState } from "react"
import pkg from "../../package.json"

function useLatestVersion() {
  const [latest, setLatest] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("https://registry.npmjs.org/brightctrl/latest")
      .then((r) => r.json() as Promise<{ version: string }>)
      .then((data) => {
        if (!cancelled) setLatest(data.version as string)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return latest
}

const Header = () => {
  const latest = useLatestVersion()

  return (
    <box flexDirection="column" marginBottom={1}>
      <box
        flexDirection="row"
        justifyContent="space-between"
        backgroundColor={"#151925"}
        paddingX={2}
        paddingY={1}
        width={"100%"}
      >
        <box flexDirection="column">
          <ascii-font text="brightctrl" font="tiny" marginBottom={1} />
          <text fg="white">External monitor brightness control</text>
          <box flexDirection="row">
            <text fg="gray">v{pkg.version}</text>
            {latest && latest !== pkg.version && (
              <text fg="yellow"> update available: v{latest}</text>
            )}
          </box>
        </box>

        <box flexDirection="row" justifyContent="flex-end">
          <text fg="gray">Press </text>
          <text fg="yellow">
            <b>?</b>
          </text>
          <text fg="gray"> for help</text>
        </box>
      </box>
    </box>
  )
}

export default Header
