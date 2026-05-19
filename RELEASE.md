# Release Guide

## Bump version

```bash
# package.json — edit version field
# PKGBUILD — edit pkgver field
```

## Build

```bash
bun run build
# produces dist/index.js (self-contained, needs only Node.js)
```

## Commit & tag

```bash
git add package.json PKGBUILD src/
git commit -m "bump v<version>"
git tag v<version>
git push origin main --tags
```

## GitHub release

```bash
cp dist/index.js brightctrl
gh release create v<version> brightctrl --title "v<version>" --notes "<summary>"
rm brightctrl
```

Release artifact: `brightctrl` (JS bundle, ~2MB)

## AUR (aur.brightctrl)

```bash
cp PKGBUILD aur/brightctrl/
cd aur/brightctrl
makepkg --printsrcinfo > .SRCINFO
git add -A
git commit -m "bump v<version>"
git push origin master
cd ../..
```

Package depends on `nodejs` + `ddcutil`. Arch: any.
