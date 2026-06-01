import { usePlatform } from "../hooks/use-platform"

export function NotSupported() {
  const { os, isSupported } = usePlatform()

  return (
    <>
      {!isSupported && (
        <box flexDirection="column">
          <box borderStyle="single" borderColor="red" paddingX={1}>
            <text fg="red">{os} is not yet supported</text>
          </box>
        </box>
      )}
    </>
  )
}
