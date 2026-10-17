#!/usr/bin/env bash
set -euo pipefail
data="${XDG_DATA_HOME:-$HOME/.local/share}"
rm -rf "$data/turbodocs"
rm -f "$HOME/.local/bin/turbodocs" "$data/applications/turbodocs.desktop" "$data/icons/hicolor/scalable/apps/turbodocs.svg"
command -v update-desktop-database >/dev/null && update-desktop-database "$data/applications" || true
command -v kbuildsycoca6 >/dev/null && kbuildsycoca6 >/dev/null 2>&1 || true
echo "Removed. Your settings and crash backups are untouched (~/.config/TurboDocs, ~/.local/share/TurboDocs)."
