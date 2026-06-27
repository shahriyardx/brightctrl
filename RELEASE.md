# Release Guide

## Bump version

Edit `version` in `Cargo.toml` and `pkgver` in `PKGBUILD`.

## Build

```bash
cargo build --release
# binary: target/release/brightctrl (no runtime deps)
```

For a portable, fully-static binary (runs on any distro regardless of glibc):

```bash
rustup target add x86_64-unknown-linux-musl
cargo build --release --target x86_64-unknown-linux-musl
# binary: target/x86_64-unknown-linux-musl/release/brightctrl
```

## Commit & tag

```bash
git add Cargo.toml Cargo.lock PKGBUILD src/
git commit -m "release v<version>"
git tag v<version>
git push origin main --tags
```

## GitHub release

```bash
cp target/x86_64-unknown-linux-musl/release/brightctrl brightctrl
gh release create v<version> brightctrl --title "v<version>" --notes "<summary>"
rm brightctrl
```

Release artifact: `brightctrl` (static ELF, ~1-2MB, zero runtime deps).

## AUR

```bash
cp PKGBUILD aur/brightctrl/
cd aur/brightctrl
makepkg --printsrcinfo > .SRCINFO
git add -A && git commit -m "bump v<version>" && git push origin master
cd ../..
```
