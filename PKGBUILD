# Maintainer: Shahriyar <shahriyardx@github.com>

pkgname=brightctrl
pkgver=0.2.5
pkgrel=1
pkgdesc="Lightweight DDC/CI external monitor brightness controller (TUI + CLI)"
arch=("x86_64")
url="https://github.com/shahriyardx/brightctrl"
license=("MIT")
depends=()
source=("brightctrl-$pkgver::$url/releases/download/v$pkgver/brightctrl"
        "LICENSE-$pkgver::$url/raw/v$pkgver/LICENSE"
        "manifest.json-$pkgver::$url/raw/v$pkgver/shell/manifest.json"
        "Panel.qml-$pkgver::$url/raw/v$pkgver/shell/Panel.qml")
sha256sums=("PENDING"
            "PENDING"
            "PENDING"
            "PENDING")

package() {
  install -Dm755 "$srcdir/brightctrl-$pkgver" "$pkgdir/usr/bin/brightctrl"
  ln -s brightctrl "$pkgdir/usr/bin/bctrl"
  ln -s brightctrl "$pkgdir/usr/bin/bc"
  install -Dm644 "$srcdir/LICENSE-$pkgver" "$pkgdir/usr/share/licenses/$pkgname/LICENSE"

  # Omarchy shell bar widget. The shell only scans ~/.config/omarchy/plugins/,
  # so this is staged here and copied into place by `brightctrl shell install`.
  install -Dm644 "$srcdir/manifest.json-$pkgver" "$pkgdir/usr/share/brightctrl/shell/manifest.json"
  install -Dm644 "$srcdir/Panel.qml-$pkgver" "$pkgdir/usr/share/brightctrl/shell/Panel.qml"
}
