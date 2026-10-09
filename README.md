# TurboDocs

Pageless, themeable word processor for Linux (PySide6) with `.docx` support.

## Install (Kubuntu / any Linux, no sudo)

```bash
./packaging/install.sh          # or --dev for an editable install
turbodocs [file.docx]           # run it from any terminal
./packaging/uninstall.sh        # remove it again
```

This creates a private venv in `~/.local/share/turbodocs`, links `~/.local/bin/turbodocs`, and adds a launcher
entry and icon (so it appears in the application menu, and `.docx` files offer "Open with TurboDocs").

Run from the source tree instead: `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && .venv/bin/python main.py`

## Install the .deb (Ubuntu / Kubuntu 26.04)

Download `turbodocs_*_all.deb` from the Releases page, then:

```bash
sudo apt install ./turbodocs_1.0.0_all.deb
```

## Highlights
- **Pageless canvas**, ~760px centred column; width and left/right margins adjustable (Ctrl+Alt+W).
- **Docx**: styles, fonts (incl. embedded), lists, links, highlights, tables (merged cells, column widths), images (size + crop), emoji.
- **Images**: click to select, drag corners to resize, double-click (or *Crop*) to crop — non-destructive, saved as real docx crops.
- **Tables**: drag column borders, right-click for row/column ops, merge and split cells. Images always stay inside their cell.
- **Document tabs** (floating panel, Ctrl+Alt+T) with outline; stored as bookmarks so files stay valid Word documents.
- **Per-document styles**: Format ▸ Paragraph styles ▸ *Update … to match selection*; defaults live in Preferences.
- **Zoom**: Ctrl+scroll, Ctrl+/Ctrl−/Ctrl+0, or the status-bar slider (scales explicitly sized text, tables and images; the status-bar control can be hidden in Preferences).
- **Window decorations**: Preferences ▸ Appearance can switch to TurboDocs' own themed title bar (Windows, macOS and GNOME styles).
- **Find / replace** (Ctrl+F / Ctrl+H, regex optional), **word count** (Ctrl+Shift+C).
- **Markdown view** (Ctrl+Alt+M): a separate text rendering; Ctrl+S there saves a `.md` and never touches the `.docx`. You can also start a Markdown document from scratch (dashboard ▸ New Markdown, or File ▸ New Markdown document, Ctrl+Alt+N) and open `.md` files directly.
- Google-Docs-style shortcuts: Ctrl+Shift+L/E/R/J align, Ctrl+[ / ] indent, Ctrl+Alt+0–3 styles, Ctrl+Shift+7/8 lists, Ctrl+K link, Ctrl+\ clear formatting.
- **Colours**: text colour, highlight, per-document page colour and table-cell background, all saved to docx.
- **Dashboard**: landing page with recent documents when you start without a file (Ctrl+Alt+H returns to it).
- **Themes**: 46 colour themes, each paired with its own font (fonts bundled, all OFL: Cantarell, Inter, Open Sans, Fira Sans, IBM Plex Sans, JetBrains Mono, Work Sans, Nunito, Lora, Source Sans 3, Space Grotesk), separate interface styles (Modern, Breeze, Rounded, GNOME, Windows 95/XP/7 Aero/8-10/11, Yaru, Terminal) and one-click presets. Styles animate like the originals (Aero glows and fades, Win11/GNOME ease, XP/95/Terminal are instant); animations and smooth scrolling can be turned off in Preferences. There is no Windows 9; Microsoft skipped it, so Windows 8 is included.
- **Preferences** (Ctrl+,): accent colour, default highlight, document defaults, editing QoL (markdown shortcuts, smart quotes, emoji codes, paste-as-plain…).
- Unsaved edits are backed up to `~/.local/share/TurboDocs/TurboDocs/backups` and offered for recovery after a crash.

## Licence

MIT — do what you like with it, modify it, share it. See `LICENSE`. Bundled fonts are under the SIL Open Font License (see `turbodocs/resources/fonts`).
