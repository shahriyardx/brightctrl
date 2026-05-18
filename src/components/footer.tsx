import { Box, Text } from "ink"

const Footer = () => {
  return (
    <Box gap={2} marginTop={2}>
      <Box>
        <Text color="gray">Config: </Text>
        <Text color="cyan">~/.config/brightctrl/config.toml</Text>
      </Box>

      <Box>
        <Text color="gray">Docs: </Text>
        <Text color="cyan">github.com/shahriyardx/brightctrl</Text>
      </Box>
    </Box>
  )
}

export default Footer
