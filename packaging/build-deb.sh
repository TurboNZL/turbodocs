#!/usr/bin/env bash
# Build an architecture-independent .deb that follows Debian/Ubuntu layout and uses the distro's own
# PySide6 and python-docx packages (no bundled virtualenv).
#   ./packaging/build-deb.sh            ->  dist/turbodocs_<version>_all.deb
#   sudo apt install ./dist/turbodocs_*_all.deb
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version="$(sed -n 's/^version = "\(.*\)"/\1/p' "$here/pyproject.toml" | head -1)"
pkg="turbodocs"
root="$(mktemp -d)"
trap 'rm -rf "$root"' EXIT
out="$here/dist"
mkdir -p "$out"

lib="$root/usr/lib/python3/dist-packages"
mkdir -p "$lib" "$root/usr/bin" "$root/usr/share/applications" \
         "$root/usr/share/icons/hicolor/scalable/apps" "$root/usr/share/doc/$pkg" "$root/DEBIAN"

# --- the Python package (no caches; they are generated at install time by py3compile)
cp -r "$here/turbodocs" "$lib/turbodocs"
find "$lib" -name __pycache__ -type d -prune -exec rm -rf {} +

# --- launcher
cat > "$root/usr/bin/turbodocs" <<'PY'
#!/usr/bin/python3
import sys

from turbodocs.app import main

sys.exit(main())
PY

# --- desktop integration
sed 's|@EXEC@|turbodocs|' "$here/packaging/turbodocs.desktop.in" > "$root/usr/share/applications/turbodocs.desktop"
install -m 644 "$here/turbodocs/resources/turbodocs.svg" "$root/usr/share/icons/hicolor/scalable/apps/turbodocs.svg"

# --- docs
cat > "$root/usr/share/doc/$pkg/copyright" <<COPY
Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/
Upstream-Name: TurboDocs

Files: *
Copyright: 2026 TurboNZ
License: Expat
 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:
 .
 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.
 .
 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.

Files: usr/lib/python3/dist-packages/turbodocs/resources/fonts/*
Copyright: see the OFL-*.txt file next to each font
License: OFL-1.1
 The bundled fonts are licensed under the SIL Open Font License 1.1; the licence
 and copyright text for each family is shipped in the same directory.
COPY
printf '%s (%s) unstable; urgency=medium\n\n  * Release %s.\n\n -- TurboNZ <turbonzonyt@gmail.com>  %s\n' \
    "$pkg" "$version" "$version" "$(date -R)" | gzip -9n > "$root/usr/share/doc/$pkg/changelog.gz"

# --- maintainer scripts: byte-compile on install, clean on removal
cat > "$root/DEBIAN/postinst" <<'SH'
#!/bin/sh
set -e
if [ "$1" = configure ] && command -v py3compile >/dev/null 2>&1; then
    py3compile -p turbodocs
fi
#DEBHELPER#
SH
cat > "$root/DEBIAN/prerm" <<'SH'
#!/bin/sh
set -e
if command -v py3clean >/dev/null 2>&1; then
    py3clean -p turbodocs
fi
#DEBHELPER#
SH
sed -i '/#DEBHELPER#/d' "$root/DEBIAN/postinst" "$root/DEBIAN/prerm"

size="$(du -sk --exclude=DEBIAN "$root" | cut -f1)"
cat > "$root/DEBIAN/control" <<CTL
Package: $pkg
Version: $version
Architecture: all
Maintainer: TurboNZ <turbonzonyt@gmail.com>
Installed-Size: $size
Depends: python3 (>= 3.10), python3-pyside6.qtcore, python3-pyside6.qtgui, python3-pyside6.qtwidgets, python3-docx (>= 1.1), libqt6svg6
Recommends: fonts-noto-color-emoji
Section: text
Priority: optional
Description: pageless, themeable word processor with .docx support
 TurboDocs is a pageless word processor built on Qt. It reads and writes
 Word (.docx) documents, including styles, tables, images and embedded
 fonts, and offers document tabs, a Markdown view, find and replace, zoom and
 many interface themes.
CTL

# normalise permissions (dpkg-deb refuses group-writable / odd modes), root ownership
find "$root" -type d -exec chmod 755 {} +
find "$root" -type f -exec chmod 644 {} +
chmod 755 "$root/usr/bin/turbodocs" "$root/DEBIAN/postinst" "$root/DEBIAN/prerm"

dpkg-deb --root-owner-group --build "$root" "$out/${pkg}_${version}_all.deb" >/dev/null
echo "Built $out/${pkg}_${version}_all.deb"
