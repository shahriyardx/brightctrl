import { Box, Text, useApp, useInput } from "ink"
import { ControlRow } from "../components/control-row"
import { useNavigation } from "../context/navigation-context"
import Footer from "../components/footer"
import Header from "../components/header"

export function HelpPage() {
  const { exit } = useApp()
  const { goHome } = useNavigation()

  useInput((input, key) => {
    if (input === "q") {
      exit()
    } else if (input === "?" || key.escape || key.return) {
      goHome()
    }
  })

  return (
    <>
      <Header />
      <Box flexDirection="column" paddingX={2}>
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color="cyan" bold>
              CONTROLS
            </Text>
          </Box>
          <Box>
            <Box flexDirection="column" width={42}>
              <ControlRow keys="↑ / k" label="Select previous monitor" />
              <ControlRow keys="↓ / j" label="Select next monitor" />
              <ControlRow keys="← / h" label="Decrease brightness" />
              <ControlRow keys="→ / l" label="Increase brightness" />
              <ControlRow keys="1 - 9" label="Select monitor by number" />
              <ControlRow keys="/" label="Enter brightness value (0-100)" />
            </Box>
            <Text color="#29313a">│ </Text>
            <Box flexDirection="column" marginLeft={2}>
              <ControlRow keys="p" label="Toggle precise mode" />
              <ControlRow keys="s" label="Sync all monitors" />
              <ControlRow keys="r" label="Refresh monitor list" />
              <ControlRow keys="q" label="Quit" />
              <ControlRow keys="?" label="Return home" />
            </Box>
          </Box>
        </Box>

        <Footer />
      </Box>
    </>
  )
}
