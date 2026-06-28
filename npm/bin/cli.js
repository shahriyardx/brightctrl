#!/usr/bin/env node
// Launcher: exec the prebuilt brightctrl binary, inheriting stdio so the TUI
// (and CLI) work directly. Binary is fetched by scripts/postinstall.js.

const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

const exe = process.platform === "win32" ? "brightctrl.exe" : "brightctrl";
const bin = path.join(__dirname, exe);

if (!fs.existsSync(bin)) {
  console.error(
    "brightctrl: binary not found. Reinstall the package so the postinstall " +
      "step can download it (needs network + Linux/x64 or Windows/x64)."
  );
  process.exit(1);
}

const res = spawnSync(bin, process.argv.slice(2), { stdio: "inherit" });
if (res.error) {
  console.error(`brightctrl: ${res.error.message}`);
  process.exit(1);
}
process.exit(res.status === null ? 1 : res.status);
