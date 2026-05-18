const OS_MAP: Record<string, string> = {
  win32: "Windows",
  darwin: "macOS",
  linux: "Linux",
}

const platform = process.platform
const osName = OS_MAP[platform] ?? platform
const supported = platform === "linux"

export function usePlatform() {
  return {
    os: osName,
    platform,
    isSupported: supported,
    isLinux: platform === "linux",
    isMac: platform === "darwin",
    isWindows: platform === "win32",
  }
}
