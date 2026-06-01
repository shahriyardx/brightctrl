import { useMonitors } from "../context/monitors-context"
import { ErrorPanel } from "./error-panel"
import { MonitorCard } from "./monitor-card"
import { MonitorsTitle } from "./monitors-title"

export function MonitorsPanel() {
  const { monitors, selected, syncMode, status, error, loading, config } =
    useMonitors()

  return (
    <box flexDirection="column">
      <MonitorsTitle />

      <box flexDirection="column">
        {loading && monitors.length === 0 ? (
          <box borderStyle="single" borderColor="#29313a">
            <text fg="gray">{status}...</text>
          </box>
        ) : error && monitors.length === 0 ? (
          <box flexDirection="column">
            <box borderStyle="single" borderColor="red">
              <text fg="red">{error}</text>
            </box>
            <ErrorPanel />
          </box>
        ) : (
          <>
            {error && (
              <box borderStyle="single" borderColor="red" marginBottom={1}>
                <text fg="red">{error}</text>
              </box>
            )}
            {monitors.map((m, i) => (
              <MonitorCard
                key={m.index}
                monitor={m}
                selected={i === selected}
                syncMode={syncMode}
                position={i + 1}
                alias={config.aliases[m.id]}
              />
            ))}
          </>
        )}
      </box>
    </box>
  )
}
