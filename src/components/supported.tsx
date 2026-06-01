import { usePlatform } from "../hooks/use-platform"

export function Supported({ children }: { children: React.ReactNode }) {
  const { isSupported } = usePlatform()
  if (!isSupported) return null
  return <>{children}</>
}
