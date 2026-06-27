#!/usr/bin/env node
// Download the prebuilt brightctrl binary for this platform from the matching
// GitHub release. brightctrl talks DDC/CI over /dev/i2c-*, so it is Linux-only.

const fs = require("fs");
const path = require("path");
const https = require("https");

const { version } = require("../package.json");
const REPO = "shahriyardx/brightctrl";
const binDir = path.join(__dirname, "..", "bin");
const dest = path.join(binDir, "brightctrl");

function fail(msg) {
  console.error(`brightctrl: ${msg}`);
  process.exit(1);
}

if (process.platform !== "linux") {
  fail(`unsupported platform '${process.platform}'. brightctrl needs Linux i2c (/dev/i2c-*).`);
}
if (process.arch !== "x64") {
  fail(`unsupported arch '${process.arch}'. Only x64 prebuilt binary is published.`);
}

const url = `https://github.com/${REPO}/releases/download/v${version}/brightctrl`;

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
