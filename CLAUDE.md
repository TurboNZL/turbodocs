# TurboDocs: project handoff

Read this first, then `PROJECT_BRIEF.md`. This file is the running state and decision log: update it whenever a decision or the state changes.

## Engine
This app is pinned to TurboNZL/turboengine (see `.turboengine.json`; `docs/development/ENGINE.md` says which modules and where they live). The engine is a **reference, not a dependency**: its modules are working code copied into apps (only `turbothemes` is installed as a package). Before building something that every app would want (updates, release naming, the theme picker, window chrome, settings layout, guides), look in the engine's `modules/` first and copy from it rather than inventing a new one. If you improve a module here, say so in the session log so it can be ported back to the engine.

## User preferences (how to work with them)
- Don't waste their usage. Fact-check and double-check yourself; use web search liberally.
- They write casually; reply in normal capitalised prose, not lowercase or slang.
- Put effort into verifying against real runs, not only unit tests.
- A merged PR cannot take new work: restart the branch from main for follow-up changes. Commit trailers as the harness gives them. Do not create a pull request unless asked.

## Decisions made (don't re-ask)
| Topic | Decision |
|---|---|
| Stack | Rewritten as an Electron + React + Tailwind app on TurboEngine; Python/Qt is retired. The old app is the branch `legacy/python` (identical to the last Python `main`, e14febc). |
| Shape | One shell with separate apps (modules) inside: Docs (docx, md, txt), Sheets (xlsx, csv), Slides (pptx). Modules can be installed and removed from inside the app. Opening a file (Open, "Open with", middle-click from a file manager) hands it to the module for its type. The user also wants to be able to set TurboDocs/its modules as the default app for those types. |
| Themes | turbothemes (in the engine repo) for the look, because the owner wants every project to look consistent. Own picker (`components/AppearancePicker.tsx`) on the headless controller with a mock-page preview; the stock element only for wallpaper/updates. One side-bar layout for now. |
| Rewrite vs Python | Decided not to combine the Python app with Electron (a bundled runtime per module, an IPC boundary, no font gain: Chromium already uses system fonts). File handling is rewritten in JavaScript. If a format's fidelity turns out too poor, a Python helper for that one format is the fallback. |
| Editor | TipTap (ProseMirror) for `.docx`; our own importer (`editor/docxImport.ts`, JSZip + @xmldom/xmldom) reads the file's XML, our own exporter (`editor/docxExport.ts`, the `docx` library) writes a NEW file from the editor's content (it does not patch the original). What cannot be represented is listed in `warnings` on import and the first overwrite asks. `.md`/`.txt` are plain-text editing (byte-exact, line endings kept), not rich. |
| Layout source | The original Python app is the reference for layout and intent: `docs/development/LEGACY_REFERENCE.md` (real screenshots + status table). Check it before changing the editor. |
| Previews | Never restyle the real page on hover. The appearance picker previews in a mock page, chips are a grid (engine PICKER.md 2a, written by us on branch `docs/picker-mock-preview` of turboengine). |
| Repos | One repo for now. Separate repos only if the modules need separate installers; keep module code behind the registry so that stays possible. |

## Repo layout
```
apps/web        React client (pages: Home, Edit, View, Settings; editor/: DocPane, TextPane, Toolbar, StatusBar, docxImport, docxExport, extensions; components: Layout, WindowFrame, AppearancePicker, AppsTab, GuidesTab, AppSettings, ThisApp)
apps/electron   main.ts (window, IPC, file opening), modules.ts (registry), desktopConfig.ts, staticServer.ts, updater*.ts, graphics/gpuModes.ts, preload.ts
docs/guides     user guides (bundled into Settings > Guides)    docs/development  internals
.github/workflows  release (vYYYY.M.N on every merge to main), check, auto-pr
```

## What exists and is tested
- Verified in a real Chromium (headless, built client): the themed shell renders, `<turbo-themes-picker>` registers and lists palettes and styles, a chosen look (Nord + Windows 11) survives a reload, the Settings tabs render. Typecheck and build of both packages pass.
- Verified in the real Electron binary under Xvfb (software rendering): window opens, the client loads from 127.0.0.1:47815, the preload bridge and IPC answer (modules, updates = disabled in a dev run, graphics), and a second launch with a file path (`electron . file.docx`) forwards it to the running window, which lists it with the module it needs.
- Docs viewer (real Electron run, Xvfb): a python-docx file (heading, bold/italic/colour, bullets, table, image, Unicode) renders correctly; `.md` renders through our safe renderer (a `<script>` in it shows as text); `.txt` shows as is. The page cannot read files it was not given: `/etc/passwd` and a `../` path are refused by the main process (allow-list of opened paths). With the bundled fonts the page makes no external requests.
- Docs editor, in the real Electron app under Xvfb with Playwright over CDP: opened a `.docx`, clicked below the text (caret goes to the end), typed, bold, Heading 2, bulleted list, text colour, highlight, 18 pt, centre, link, 3x3 table, picture from disk, undo/redo, width, zoom, Ctrl+S. The saved file was read back with python-docx (styles, runs, colour, shading, size, alignment, hyperlink target, both pictures, tables incl. merged cells) AND rendered by LibreOffice (everything present). The original was copied to `<userData>/backups` first. `.md`, CRLF `.md` and `.txt` saved byte-exact. Leaving with unsaved changes raises the confirm and Cancel keeps the page.
- Importer/exporter unit tests (`apps/web/test/docx.test.ts`): a python-docx file and a LibreOffice-saved file (merged cells, nested/numbered lists, highlight, centre, Georgia 18 pt) import into the editor's schema without warnings and survive export then import unchanged. `apps/electron/test/modules.test.ts`: routing by extension, argv parsing. `pnpm -r test` passes (it used to exit 1: the Electron package had no tests, so the Check workflow on main failed).
- NOT verified (Docs): documents written by Word itself (only python-docx and LibreOffice files), big or complex files, the native Save as dialog (a new document's first save: Xvfb cannot drive it), pasting from Word/web, keyboard shortcuts beyond Ctrl+B/I/U/Z/S, spell-check, RTL text, text in a language with its own font, links clicked inside a document, the window-close confirm (native dialog), Windows/macOS.
- CI on GitHub (checked 2026-10-14): `Check` failed on the first two merges to main (the Electron package had no tests, exit 1) and has passed since the fix (run 3, PR #3 merge). `Release` succeeded on every merge and published v2026.10.0, v2026.10.1 and v2026.10.2. `auto-pr.yml` opens a PR for every pushed branch (as designed). NOT checked: that the built installers (.deb, AppImage, Windows setup) exist as assets, install or start.
- NOT verified: the self-updater against a real release (no release exists yet), the .deb/AppImage/NSIS packaging (never built here), custom window frame in a real window, Wayland/GPU paths, macOS.

## Hard-won gotchas
- `pnpm install --ignore-scripts` (CI) skips the Electron binary: run a plain `pnpm install` locally.
- turbothemes is pinned by commit: `git+https://github.com/TurboNZL/turboengine.git#<commit>&path:/themes` (same commit as `.turboengine.json` `engine.ref`). With a commit in the specifier pnpm records an https tarball (codeload) in the lockfile, which CI can fetch; WITHOUT a commit it writes an SSH address (`git@github.com:...`) that CI cannot clone and that had to be fixed by hand. Never drop the commit. `docs/development/ENGINE.md` says how to update the pin.
- Icons are generated from `branding/logo.json` (engine `logos` module): never edit them by hand.
- `pnpm/action-setup@v4` fails if the version is given both in the workflow (`with: version`) and in `package.json` `packageManager`. TurboDocs keeps it only in `packageManager`. The engine's `release-pipeline` workflows pin `version: 10`, so any app that sets `packageManager` hits this; port the note back.
- The window loads the client from `http://127.0.0.1:47815` (fixed port) so its storage keeps the user's look. Change it only with `TURBODOCS_DESKTOP_PORT`.
- `auto-pr.yml` ignores `legacy/**` so the legacy branch never gets a PR against main.

- A second launch must not start up: `app.quit()` is asynchronous, so without the `primary` guard in `main.ts` the second process found the port taken and opened an unclosable error dialog. The engine's `window-frame/main.ts` has the same pattern and should get the same guard.
- The "Automatic" graphics mode relaunches the app up to five times when there is no GPU (a headless sandbox): set `TURBODOCS_SOFTWARE_RENDERING=1` when driving the app from a script.

- Word draws bullets with private-use Symbol/Wingdings characters (U+F0B7 ...) that Linux lacks: `fixSymbolBullets` in `pages/View.tsx` maps the common ones to Unicode. Other Symbol glyphs fall back to a plain bullet.
- `apps/web/src/fonts.css` is generated (`node apps/web/scripts/gen-fonts.mjs`, then `pnpm add` the packages it prints). Re-run it after updating turbothemes.
- The page may read only files that came through Open, the command line or the system (`allowed` in `main.ts`). New features that read files must go through the same list.

- The importer uses `@xmldom/xmldom`, not the browser's DOMParser, so the same parser runs in the app and in the tests (happy-dom's DOMParser is not a real XML parser).
- React 19 sets attributes of a custom element as properties when the element has a member of that name: `<turbo-themes-picker sections="...">` replaces the element's private `sections()` method and throws. `AppearancePicker.tsx` creates the element with `setAttribute` (`StockPicker`).
- A click in the empty area below the text lands on the editor's root element and leaves the caret at offset 0 (typing then goes to the START). `DocPane` moves the caret to the end in that case.
- While a document has unsaved changes, opening another file (second launch, Open) raises a blocking `window.confirm`: a script driving the app (CDP) hangs on it. Save or restart the app between runs.
- When driving the editor with a script, wait ~250 ms after closing the link popover before the next keystroke: TipTap hands focus back asynchronously, and `Enter` with the line still selected replaces it.
- StarterKit's trailing node keeps an empty paragraph at the end after a list or table; it is exported as an empty paragraph.
- DOM `img` counts in the editor include ProseMirror's spacer images; count pictures in the saved file instead.
- The page may only WRITE to files it was allowed to read (or chose in Save as), and only types a module opens; writes are atomic (temp file + rename) after a backup.

## Open questions / next
1. Module delivery: how does "install Sheets" get code into the app (download a bundle from releases? separate installers that register with the shell?) and how do file associations follow install/uninstall? Needs a design before any module is built.
2. Docs editing exists for .docx/.md/.txt. Next: try REAL Word-authored files (ask the owner for a few) and fix what the importer misses; then the gaps in `docs/development/LEGACY_REFERENCE.md` (find and replace, menu bar, recent documents, crash backups, document tabs, image resize/crop). Sheets: viewer first (formulas need a calc engine). Slides: rendering is the hard part.
3. Drag-and-drop of files onto the window; file associations ("Open with" entries) are not declared in the installer yet.
4. Layouts (where pages are listed) are the app's job; only a side bar exists.

## Session log
- 2026-10-14: Pin moved from 6b26f24 to engine 7dbbe2e (the engine merged our picker docs; it also split `window-frame`, added `logos` and renamed Curator to TurboMusic, and made `logos` mandatory). Added modules `gpu-modes` and `logos` (icons now generated; emblem `doc`, teal). Removed the `textarea.input` stopgap CSS the engine dropped (its themes already cap the radius: measured 20 px radius, 16 px padding under Spotify/YouTube Music). `turbothemes` dependency now pinned to the same commit; lockfile records an https tarball. Verified after the move: typecheck, `pnpm -r test`, build, picker checks in Chromium, a clean frozen install, an edit-and-save in the real app.
- 2026-10-13: Docs editing: TipTap editor (legacy toolbar order, pageless canvas, status bar), docx importer/exporter with warnings, guarded write-file with backups, Save as, dirty guards, md/txt text editor, New document / New Markdown. Appearance picker rebuilt on the mock-page rule. Legacy app screenshots + `LEGACY_REFERENCE.md`. Fixed `pnpm -r test` (CI). Engine docs updated on turboengine branch `docs/picker-mock-preview` (PICKER.md 2a: no hover-restyle of the real page, chip grid, the stock element's two bugs and the React 19 `sections` clash) — to port back: the single-instance `primary` guard (earlier) and nothing else yet.
- 2026-10-13: Bundled the theme fonts (offline); built the Docs viewer (.docx via docx-preview, .md, .txt) with a guarded read-file IPC and a `/view` page; fixed missing Symbol bullets.
- 2026-10-13: CI failed on the duplicate pnpm version (above); removed `version: 10` from `check.yml` and `release.yml`. Not yet seen passing on GitHub.
- 2026-10-13 (engine fix to port back): `primary` single-instance guard in `apps/electron/src/main.ts`.
- 2026-10-13: Rewrote the repo on TurboEngine (engine at 6b26f24). Moved the Python app to `legacy/python`. Added the shell, module registry and engine modules as described in `docs/development/ENGINE.md`.
