import { detectMonitors, getBrightness, setBrightness } from "./ddcutil"
import { checkDdcutil } from "./ddcutil"
import {
  getConfig,
  getAlias,
  setAlias,
  unsetAlias,
  CONFIG_PATH,
} from "./config"

function fail(msg: string): never {
  console.error(`error: ${msg}`)
  process.exit(1)
}

async function resolveTarget(
  target: string,
): Promise<{ index: number; id: string; name: string }> {
  const monitors = await detectMonitors()
  const config = getConfig()

  const asNum = Number.parseInt(target, 10)
  if (!Number.isNaN(asNum)) {
    const m = monitors.find((x) => x.index === asNum)
    if (m) return { index: m.index, id: m.id, name: m.name }
  }

  {
    const m = monitors.find((x) => x.id === target)
    if (m) return { index: m.index, id: m.id, name: m.name }
  }

  const aliasEntry = Object.entries(config.aliases).find(
    ([, v]) => v === target,
  )
  if (aliasEntry) {
    const m = monitors.find((x) => x.id === aliasEntry[0])
    if (m) return { index: m.index, id: m.id, name: m.name }
  }

  fail(`no monitor found for "${target}"`)
}

async function cmdList() {
  const config = getConfig()
  const monitors = await detectMonitors()

  if (monitors.length === 0) {
    console.log("No DDC/CI monitors detected")
    return
  }

  console.log(
    ["ID".padEnd(16), "NAME".padEnd(22), "ALIAS".padEnd(12), "BRIGHTNESS"].join(
      "",
    ),
  )
  console.log("-".repeat(60))

  const brightnesses = await Promise.all(
    monitors.map((m) => getBrightness(m.index)),
  )

  for (const [i, m] of monitors.entries()) {
    const brightness = brightnesses[i]
    const alias = config.aliases[m.id]
    const parts = [
      m.id.padEnd(16),
      (m.name.length > 20 ? `${m.name.slice(0, 17)}...` : m.name).padEnd(22),
      alias ? alias.padEnd(12) : "-".padEnd(12),
      brightness != null ? `${brightness}%` : "N/A",
    ]
    console.log(parts.join(""))
  }
}

async function cmdGet(target: string) {
  const { index, id, name } = await resolveTarget(target)
  const brightness = await getBrightness(index)
  if (brightness == null) fail(`could not read brightness for ${id} (${name})`)
  console.log(brightness)
}

async function cmdSet(target: string, valueStr: string) {
  const value = Number.parseInt(valueStr, 10)
  if (Number.isNaN(value) || value < 0 || value > 100) {
    fail("value must be a number between 0 and 100")
  }

  const { index, id, name } = await resolveTarget(target)
  const ok = await setBrightness(index, value)
  if (!ok) fail(`could not set brightness for ${id} (${name})`)
  console.log(value)
}

function cmdAlias(id: string, alias: string | undefined) {
  if (!id) fail("usage: brightctrl alias <monitor-id> <name>")

  if (!alias) {
    const existing = getAlias(id)
    if (!existing) fail(`no alias set for ${id}`)
    unsetAlias(id)
    console.log(`removed alias "${existing}" for ${id}`)
    return
  }

  setAlias(id, alias)
  console.log(`alias "${alias}" set for ${id}`)
}

function cmdHelp() {
  console.log(`
Usage: brightctrl [command]

Commands:
  list                    List detected monitors with IDs, aliases, brightness
  get    <target>         Get brightness (0-100) for a monitor
  set    <target> <0-100> Set brightness for a monitor
  alias  <id> <name>      Register a human-friendly alias for a monitor ID
  alias  <id>             Remove an alias
  help                    Show this help

Target can be: monitor number (1), monitor ID (ABC123), or alias name (left)

Config: ${CONFIG_PATH}
`)
}

export async function runCLI(args: string[]) {
  const cmd = args[0]

  if (!cmd || cmd === "help") {
    cmdHelp()
    return
  }

  if (cmd === "alias") {
    cmdAlias(args[1], args[2])
    return
  }

  const hasBackend = await checkDdcutil()
  if (!hasBackend) {
    fail("ddcutil not found")
  }

  switch (cmd) {
    case "list":
      await cmdList()
      break
    case "get":
      if (!args[1]) fail("usage: brightctrl get <target>")
      await cmdGet(args[1])
      break
    case "set":
      if (!args[1] || !args[2]) fail("usage: brightctrl set <target> <0-100>")
      await cmdSet(args[1], args[2])
      break
    default:
      fail(`unknown command "${cmd}". Try "brightctrl help"`)
  }
}
