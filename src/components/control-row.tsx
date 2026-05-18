import { Box, Text } from "ink"

export function ControlRow({ keys, label }: { keys: string; label: string }) {
  return (
    <Box>
      <Box width={9}>
        <Text color="yellow">[ {keys} ]</Text>
      </Box>
      <Text color="gray">{label}</Text>
    </Box>
  )
}
