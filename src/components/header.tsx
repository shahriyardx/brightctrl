import { Box, Text } from "ink"
import pkg from "../../package.json"

const Header = () => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box backgroundColor="#151925" paddingX={2} paddingY={1}>
        <Box flexDirection="column" width={78}>
          <Text color="green" bold>
            brightctrl
          </Text>
          <Text color="white">
            External monitor brightness control
          </Text>
          <Text color="gray">v{pkg.version}</Text>
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
