export function ControlRow({ keys, label }: { keys: string; label: string }) {
  return (
    <box flexDirection="row" gap={2}>
      <box>
        <text fg="yellow">[ {keys} ]</text>
      </box>
      <text fg="gray">{label}</text>
    </box>
  )
}
