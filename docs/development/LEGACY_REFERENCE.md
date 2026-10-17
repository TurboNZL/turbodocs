# Reference: the original TurboDocs (Python / Qt)

The editor in the new app copies the **intent and layout** of the first TurboDocs, which lived on the branch `legacy/python`. **That branch was deleted on 2026-10-17, once everything below was ported.** Nothing was lost: its last commit, `e14febc`, is an ancestor of `main` (`git show e14febc:turbodocs/prefs.py`), and its uninstall script is `scripts/uninstall-legacy-python.sh`. These screenshots were taken by running that branch headless (`reference/legacy-python/capture.py`, PySide6 with `QT_QPA_PLATFORM=offscreen`, a generated 37-word `.docx`), so they are the real thing, not mock-ups. Check them before changing the editor's layout.

| | |
|---|---|
| ![Editor, Graphite + Modern](reference/legacy-python/01-editor-graphite-modern.png) | ![Editor, Windows 11 light](reference/legacy-python/04-editor-win11-light.png) |
| Editor in the default look (dark). | The same window in a light look: only colours and widget shapes change. |
| ![Document tabs panel](reference/legacy-python/02-tabs-panel.png) | ![Dashboard](reference/legacy-python/07-dashboard.png) |
| The floating document-tabs panel (open). Closed, it is the ☰ button at the top left of the canvas. | The landing page. |
| ![Windows 7 Aero](reference/legacy-python/06-editor-win7-aero.png) | ![Preferences](reference/legacy-python/08-preferences.png) |
| A skeuomorphic style: layout identical. | Preferences: a list of sections on the left, OK / Cancel / Apply. |

Menus: [File](reference/legacy-python/menu-file.png), [Format](reference/legacy-python/menu-format.png), [Insert](reference/legacy-python/menu-insert.png).

## The layout, top to bottom
1. **Menu bar:** File, Edit, View, Insert, Format, Tools.
   - File: Home, New, New Markdown, Open, Open recent, Save, Save as, Reset session edits, Preferences, Quit.
   - Edit: Undo, Redo, Cut, Copy, Paste, Paste as plain text, Select all, Find, Replace.
   - View: Markdown view, Document tabs, Text width and margins, Zoom in / out / reset, Full screen.
   - Insert: Image, Table, Link, Emoji, Date.
   - Format: Text (bold, italic, underline, strike, text and highlight colour, size up/down, clear formatting), Paragraph styles (with "Update … to match selection", reset, "save as my defaults"), Align and indent, Line and paragraph spacing, Bulleted list, Numbered list, Page colour, Image (crop, reset size, original size), Table (rows, columns, merge, split, cell colour, delete).
   - Tools: Word count, Preferences.
2. **One formatting toolbar**, in this order: Undo, Redo | paragraph style | font family | size | **B** *I* <u>U</u> | text colour | highlight colour | align left, centre, right, justify | line and paragraph spacing | bullets, numbers, outdent, indent | link, image, table, emoji | *(flexible space)* | **Width** button.
   - Paragraph style choices: Normal text, Title, Subtitle, Heading 1, Heading 2, Heading 3, Bulleted list, Numbered list.
   - The two colour controls are Docs-style **split buttons**: the icon applies the last colour used, the small arrow opens the picker.
   - The size box is editable (presets 8 to 72).
3. **The canvas is pageless**: the text sits directly on the theme's background, no white sheet, in a centred column (default 760 px). The Width button (Ctrl+Alt+W) sets the column width and the left and right margins. Zoom is 25 to 400 %.
4. **A floating ☰ button at the top left of the canvas** opens the **document tabs** panel: tabs inside one document with an outline. They are stored as bookmarks so the file stays an ordinary Word document.
5. **Status bar:** word count (it counts the selection when there is one), then zoom: − slider + percentage.
6. **Dashboard:** logo and name, the tagline "Pageless writing with full .docx compatibility", buttons **New document** (accent), **New Markdown**, **Open file…**, then "Recent documents" as cards (title, how long ago, folder, the first words), a Clear list button, and a tip line ("Ctrl+O to open, Ctrl+Alt+H to come back to this page").
7. **Preferences:** General, Document defaults, Paragraph styles, Editing, Appearance.

## Intent (what it was for)
- Write like in Google Docs, but on a `.docx` that Word opens unchanged: **full compatibility, nothing lost silently**.
- Pageless and calm: the document, a toolbar, nothing else. Every colour comes from the theme; the document follows the theme unless a page colour is set.
- Predictable shortcuts, Google-Docs style: Ctrl+Shift+L/E/R/J align, Ctrl+[ / ] indent, Ctrl+Alt+0 to 3 styles, Ctrl+Shift+7 / 8 lists, Ctrl+K link, Ctrl+\ clear formatting, Ctrl+F / H find and replace, Ctrl+Shift+C word count.
- **Never lose work**: unsaved edits are backed up 1.5 s after the last keystroke and offered back after a crash.
- Markdown is a separate rendering: Ctrl+S in Markdown view saves a `.md` and never touches the `.docx`; a Markdown document can also be started from scratch.
- Images and tables stay editable: click an image to select it, drag a corner to resize, double-click to crop (non-destructive, saved as real docx crops); drag table column borders, right-click for row and column operations, merge and split cells, cell colour.

## Paragraph style defaults (from `styles.py`)
| Style | Size | Weight / style | Colour | Space before / after (px) | Line |
|---|---|---|---|---|---|
| Normal | document default (11 pt) | | | 0 / 6 | 1.18 |
| Title | 28 pt | bold | | 0 / 8 | 1.18 |
| Subtitle | 15 pt | italic | #808080 | 0 / 8 | 1.18 |
| Heading 1 | 22 pt | bold | | 18 / 8 | 1.18 |
| Heading 2 | 17 pt | bold | | 14 / 8 | 1.18 |
| Heading 3 | 14 pt | bold | | 10 / 8 | 1.18 |

Word's Heading 4 to 6 map to Heading 3. Defaults from `prefs.py`: column 760 px, margins 0, document font Carlito (metric-compatible with Calibri), 11 pt, zoom 100 %, backups after 1500 ms.

## Where the new editor stands against it
Every feature above is ported (checked 2026-10-17 by running the real Electron app and comparing; the file-level ones by reading the saved files back with python-docx and LibreOffice).

| Legacy feature | New app |
|---|---|
| Pageless canvas on the theme background, centred column | done; width and left / right margins (Ctrl+Alt+W) |
| Toolbar in the same order, split colour buttons, editable size | done, plus emoji; the colour popovers remember your custom colours |
| Paragraph styles with the table's values; "update to match selection", reset, save as my defaults | done (Format › Paragraph styles); the document's own styles are read and written back |
| Menu bar (File, Edit, View, Insert, Format, Tools) | done (`components/MenuBar.tsx`, `editor/docMenus.ts`) with the legacy's items, shortcuts and submenus, plus Open recent |
| Status bar: word count (selection-aware), zoom | done; both can be hidden in Settings › Documents |
| Dashboard: New / New Markdown / Open / recent cards, the tagline | done (New spreadsheet and New presentation added) |
| Find and replace | done |
| Word count dialog, emoji, date, paste as plain text | done (Ctrl+Shift+C, Insert › Emoji and `:shortcodes:`, Insert › Date and time, Edit › Paste as plain text and the "plain by default" option) |
| Document tabs panel (☰) and outline | done (`editor/tabs.ts`, `OutlinePanel.tsx`). Tabs are stored as bookmarks `tdtab_<n>` around a title line (the legacy kept the titles in the core properties' comment, so a legacy file's tabs open as untitled sections) |
| Images: select, resize by dragging, crop (non-destructive, saved as real docx crops), original size | done (`editor/ImageView.tsx`; the crop is written as `a:srcRect`, `docxExport.ts` `patchCrops`) |
| Tables: insert, rows and columns, merge and split, cell colour, drag column borders | done |
| Crash backups after 1.5 s idle, offered back after a crash | done (`useAutosave.ts`, main-process `turbodocs:autosave-*`); File › Reset session edits |
| Markdown separate from the docx (Ctrl+S saves a `.md`) | done (View › Markdown view); `.md` and `.txt` files are also edited as plain text |
| Preferences: General, Document defaults, Paragraph styles, Editing, Appearance | Settings › Documents (the first four, incl. default folder, reopen last document, backup delay) and Settings › Appearance |
| Page colour | done (Format › Page colour; saved as the document background) |
| Registered as the application for .docx, .md, .txt | done (and now .xlsx, .csv, .pptx) |
| Google-Docs shortcuts | done: see `docs/guides/SHORTCUTS.md` |

Not ported on purpose: the legacy's cursor-width and UI-size preferences (the theme and the system decide), and its Qt-specific "translucent window" and "smooth scroll" switches.
