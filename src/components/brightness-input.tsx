import { useMonitors } from "../context/monitors-context"

export function BrightnessInput() {
  const { typing, syncMode, handleInputSubmit } = useMonitors()

  return (
    <>
      {typing && syncMode && (
        <box borderStyle="single" borderColor="#29313a">
          <input
            placeholder="Enter brightness 0-100"
            focused
            onSubmit={(e) => handleInputSubmit(String(e))}
          />
        </box>
      )}
    </>
  )
}
