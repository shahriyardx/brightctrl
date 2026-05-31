export function ErrorPanel() {
  const plat = process.platform
  if (plat === "darwin" || plat === "win32") return null

  return (
    <box flexDirection="column" marginTop={1}>
      <text fg="yellow">Troubleshooting:</text>
      <text fg="gray"> sudo pacman -S ddcutil</text>
      <text fg="gray"> sudo usermod -aG i2c $USER</text>
      <text fg="gray"> sudo modprobe i2c-dev</text>
      <text fg="gray">
        echo 'i2c-dev' | sudo tee /etc/modules-load.d/i2c.conf
      </text>
      <text fg="gray"> (log out and in for group change)</text>
    </box>
  )
}
