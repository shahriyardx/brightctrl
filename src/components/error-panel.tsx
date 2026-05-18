import { Box, Text } from "ink"

export function ErrorPanel() {
  const plat = process.platform
  if (plat === "darwin" || plat === "win32") return null

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color="yellow">Troubleshooting:</Text>
      <Text color="gray"> sudo pacman -S ddcutil</Text>
      <Text color="gray"> sudo usermod -aG i2c $USER</Text>
      <Text color="gray"> sudo modprobe i2c-dev</Text>
      <Text color="gray">
        echo 'i2c-dev' | sudo tee /etc/modules-load.d/i2c.conf
      </Text>
      <Text color="gray"> (log out and in for group change)</Text>
    </Box>
  )
}
