export function ControlRow({ keys, label }: { keys: string; label: string }) {
  return (
    <box>
      <box width={9}>
        <text fg="yellow">[ {keys} ]</text>
      </box>
      <text fg="gray">{label}</text>
    </box>
  )
}
