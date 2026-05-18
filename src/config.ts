import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { parse, stringify } from "smol-toml"

export type BrightCtrlConfig = {
  aliases: Record<string, string>
}

const CONFIG_DIR = join(homedir(), ".config", "brightctrl")
const CONFIG_PATH = join(CONFIG_DIR, "config.toml")

const DEFAULT: BrightCtrlConfig = {
  aliases: {},
}

function ensureConfig(): BrightCtrlConfig {
  if (!existsSync(CONFIG_PATH)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
    writeFileSync(CONFIG_PATH, stringify(DEFAULT), "utf-8")
    return { ...DEFAULT }
  }

  const raw = readFileSync(CONFIG_PATH, "utf-8")
  const parsed = parse(raw) as BrightCtrlConfig

  return {
    aliases: (parsed.aliases ?? {}) as Record<string, string>,
  }
}

let cached: BrightCtrlConfig | null = null

export function getConfig(): BrightCtrlConfig {
  if (!cached) cached = ensureConfig()
  return cached
}

export function getAlias(id: string): string | null {
  return getConfig().aliases[id] ?? null
}

export function setAlias(id: string, alias: string): BrightCtrlConfig {
  const config = getConfig()
  config.aliases[id] = alias
  writeFileSync(CONFIG_PATH, stringify(config), "utf-8")
  return config
}

export function unsetAlias(id: string): BrightCtrlConfig {
  const config = getConfig()
  delete config.aliases[id]
  writeFileSync(CONFIG_PATH, stringify(config), "utf-8")
  return config
}

export { CONFIG_PATH }
