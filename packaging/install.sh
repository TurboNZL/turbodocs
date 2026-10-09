#!/usr/bin/env bash
# Per-user install: no sudo, nothing outside your home directory.
#   ./packaging/install.sh          install (or upgrade) TurboDocs
#   ./packaging/install.sh --dev    editable install: source edits take effect immediately
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
data="${XDG_DATA_HOME:-$HOME/.local/share}"
app="$data/turbodocs"
bin="$HOME/.local/bin"

python3 -m venv "$app/venv"
"$app/venv/bin/pip" install --quiet --upgrade pip
if [[ "${1:-}" == "--dev" ]]; then
    "$app/venv/bin/pip" install --quiet -e "$here"
else
    "$app/venv/bin/pip" install --quiet --upgrade "$here"
fi

mkdir -p "$bin" "$data/applications" "$data/icons/hicolor/scalable/apps"
ln -sf "$app/venv/bin/turbodocs" "$bin/turbodocs"
install -m 644 "$here/turbodocs/resources/turbodocs.svg" "$data/icons/hicolor/scalable/apps/turbodocs.svg"
# absolute Exec path: launchers don't always have ~/.local/bin on PATH
sed "s|@EXEC@|$bin/turbodocs|" "$here/packaging/turbodocs.desktop.in" > "$data/applications/turbodocs.desktop"
chmod 644 "$data/applications/turbodocs.desktop"

command -v update-desktop-database >/dev/null && update-desktop-database "$data/applications" || true
command -v gtk-update-icon-cache  >/dev/null && gtk-update-icon-cache -q -t "$data/icons/hicolor" || true
command -v kbuildsycoca6          >/dev/null && kbuildsycoca6 >/dev/null 2>&1 || true

echo "Installed. Run:  turbodocs [file.docx]"
case ":$PATH:" in
    *":$bin:"*) ;;
    *) echo "Note: $bin is not on your PATH yet. Log out and back in (Ubuntu adds it automatically once the folder exists), or run: export PATH=\"\$HOME/.local/bin:\$PATH\"" ;;
esac
