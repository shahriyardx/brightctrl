#!/usr/bin/env node
// Download the prebuilt brightctrl binary for this platform from the matching
// GitHub release. DDC/CI brightness needs Linux i2c or the Windows Monitor
// Configuration API, so only linux/x64 and win32/x64 are supported.

const fs = require("fs");
const path = require("path");
const https = require("https");

const { version } = require("../package.json");
const REPO = "shahriyardx/brightctrl";
const binDir = path.join(__dirname, "..", "bin");

function fail(msg) {
  console.error(`brightctrl: ${msg}`);
  process.exit(1);
}

// Per-platform release asset name + local binary filename.
const ASSETS = {
  linux: { asset: "brightctrl", file: "brightctrl" },
  win32: { asset: "brightctrl.exe", file: "brightctrl.exe" },
};

const target = ASSETS[process.platform];
if (!target) {
  fail(`unsupported platform '${process.platform}'. Supported: Linux, Windows.`);
}
if (process.arch !== "x64") {
  fail(`unsupported arch '${process.arch}'. Only x64 prebuilt binaries are published.`);
}

const dest = path.join(binDir, target.file);
const url = `https://github.com/${REPO}/releases/download/v${version}/${target.asset}`;

function download(u, redirects = 0) {
  if (redirects > 5) return fail("too many redirects");
  https
    .get(u, { headers: { "User-Agent": "brightctrl-installer" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return download(res.headers.location, redirects + 1);
      }
      if (res.statusCode !== 200) {
        return fail(`download failed (HTTP ${res.statusCode}) from ${u}`);
      }
      fs.mkdirSync(binDir, { recursive: true });
      const tmp = dest + ".download";
      const out = fs.createWriteStream(tmp);
      res.pipe(out);
      out.on("finish", () => {
        out.close(() => {
          fs.renameSync(tmp, dest);
          fs.chmodSync(dest, 0o755);
        });
      });
      out.on("error", (e) => fail(e.message));
    })
    .on("error", (e) => fail(e.message));
}

download(url);
