import { Box, Text } from "ink"
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
    return () => { cancelled = true }
  }, [])

  return latest
}

const Header = () => {
  const latest = useLatestVersion()

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box backgroundColor="#151925" paddingX={2} paddingY={1}>
        <Box flexDirection="column" width={78}>
          <Text color="green" bold>
            brightctrl
          </Text>
          <Text color="white">External monitor brightness control</Text>
          <Box>
            <Text color="gray">v{pkg.version}</Text>
            {latest && latest !== pkg.version && (
              <Text color="yellow"> update available: v{latest}</Text>
            )}
          </Box>
        </Box>
        <Box justifyContent="flex-end" flexGrow={1}>
          <Text color="gray">Press </Text>
          <Text color="yellow" bold>
            ?
          </Text>
          <Text color="gray"> for help</Text>
        </Box>
      </Box>
    </Box>
  )
}

export default Header
