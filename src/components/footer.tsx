const Footer = () => {
  return (
    <box gap={2} marginTop={2}>
      <box>
        <text fg="gray">Config: </text>
        <text fg="cyan">~/.config/brightctrl/config.toml</text>
      </box>

      <box>
        <text fg="gray">Docs: </text>
        <text fg="cyan">github.com/shahriyardx/brightctrl</text>
      </box>
    </box>
  )
}

export default Footer
