const Footer = () => {
  return (
    <box
      flexDirection="row"
      justifyContent="space-between"
      gap={2}
      marginTop={2}
    >
      <box flexDirection="row" gap={1}>
        <text fg="gray">Config:</text>
        <text fg="cyan">~/.config/brightctrl/config.toml</text>
      </box>

      <box flexDirection="row" gap={1}>
        <text fg="gray">Docs:</text>
        <text fg="cyan">github.com/shahriyardx/brightctrl</text>
      </box>
    </box>
  )
}

export default Footer
