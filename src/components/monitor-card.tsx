import type { Monitor } from "../ddcutil"
import { BrightnessBar } from "./brightness-bar"
import { useMonitors } from "../context/monitors-context"

export function MonitorCard({
  monitor,
  selected,
  syncMode,
  position,
  alias,
}: {
  monitor: Monitor
  selected: boolean
  syncMode: boolean
  position: number
  alias?: string | null
  editing?: boolean
  editBuffer?: string
}) {
  const { typing, handleInputSubmit } = useMonitors()
  const accent = selected || syncMode ? "cyan" : "gray"

  return (
    <box
      borderStyle="single"
      borderColor={accent}
      paddingX={2}
      marginBottom={0}
      flexDirection="row"
      width={"100%"}
    >
      <box
        flexDirection="column"
        justifyContent="space-between"
        gap={1}
        width={"50%"}
      >
        <box flexDirection="column">
          <box flexDirection="row" gap={1}>
            <text fg={accent}>
              <b>{monitor.name}</b>
            </text>

            {alias && <text fg="gray">({alias})</text>}
          </box>
          <text fg="gray">
            {monitor.bus
              ? `Bus: ${monitor.bus}`
              : `ID: ${monitor.id || "Unknown"}`}
          </text>
        </box>
      </box>

      <box flexDirection="column" width={"50%"} alignItems="flex-end">
        <box>
          {typing && selected && !syncMode ? (
            <input
              width={20}
              placeholder="Enter Brightness..."
              onSubmit={(v) => handleInputSubmit(String(v))}
              focused
            />
          ) : (
            <text fg={accent}>
              <b>{Math.round(monitor.brightness)}%</b>
            </text>
          )}
        </box>

        <BrightnessBar
          value={monitor.brightness}
          color={accent}
          showValue={false}
        />
      </box>
    </box>
  )
}
