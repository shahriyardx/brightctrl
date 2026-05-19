import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { parse, stringify } from "smol-toml"
import type { Monitor } from "./ddcutil"

export type BrightCtrlConfig = {
  aliases: Record<string, string>
  syncMode: boolean
  preciseMode: boolean
}

const CONFIG_DIR = join(homedir(), ".config", "brightctrl")
const CONFIG_PATH = join(CONFIG_DIR, "config.toml")
const CACHE_PATH = join(CONFIG_DIR, "monitors.json")

const DEFAULT: BrightCtrlConfig = {
  aliases: {},
  syncMode: false,
  preciseMode: false,
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
    syncMode: parsed.syncMode ?? false,
    preciseMode: parsed.preciseMode ?? false,
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

export function setSyncMode(value: boolean): BrightCtrlConfig {
  const config = getConfig()
  config.syncMode = value
  writeFileSync(CONFIG_PATH, stringify(config), "utf-8")
  return config
}

export function setPreciseMode(value: boolean): BrightCtrlConfig {
  const config = getConfig()
  config.preciseMode = value
  writeFileSync(CONFIG_PATH, stringify(config), "utf-8")
  return config
}

export function readMonitorCache(): Monitor[] | null {
  try {
    if (!existsSync(CACHE_PATH)) return null
    const raw = readFileSync(CACHE_PATH, "utf-8")
    return JSON.parse(raw) as Monitor[]
  } catch {
    return null
  }
}

export function writeMonitorCache(monitors: Monitor[]): void {
  try {
    writeFileSync(CACHE_PATH, JSON.stringify(monitors, null, 2), "utf-8")
  } catch {
    // cache write failure is non-critical
  }
}

export { CONFIG_PATH }
