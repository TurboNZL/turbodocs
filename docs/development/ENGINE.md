# How TurboDocs uses TurboEngine

Pinned in `.turboengine.json` (engine commit, modules used, what moved). The engine is a reference, not a dependency, except `turbothemes`, which is installed as a package from the same commit: `git+https://github.com/TurboNZL/turboengine.git#<commit>&path:/themes` in `apps/web/package.json`. With a commit in the specifier pnpm records an https tarball in the lockfile (no SSH address to fix by hand).

## Updating the pin
1. In a checkout of the engine: `git pull`, then `node scripts/engine-diff.mjs <path to turbodocs> --show`. Read the engine's `CLAUDE.md` (it adds rules, for example module splits and the mandatory `logos`) and the `MODULE.md` of each module we use.
2. Port what is wanted (most differences are renames: our files say TurboDocs, the engine's say TurboMusic).
3. Put the new commit in `.turboengine.json` (`engine.ref`) AND in the `turbothemes` specifier, run `pnpm install`, then `node apps/web/scripts/gen-fonts.mjs` (new themes may need new fonts).
4. `pnpm -r typecheck && pnpm -r test`, build, and look at Settings > Appearance and an edit-and-save in the real app.

| Engine module | Where it lives here | Differences from the engine's copy |
|---|---|---|
| `release-pipeline` | `.github/workflows/` | Desktop only (no Android, no server editions); `auto-pr.yml` ignores `legacy/**`. |
| `updaters` | `apps/electron/src/{updater,updateErrors,debInstall}.ts`, `apps/web/src/components/AppSettings.tsx`, `lib/native.ts` | Renamed; Android parts and the Discord card dropped. The updater has not run against a real release yet. |
| `appearance` | `apps/web/src/lib/appearance.ts`, `components/AppearancePicker.tsx`, `tailwind.config.ts`, `index.css` | `persist: true`; the picker is our own on the headless controller, with the mock page and chip grid the engine's PICKER.md section 2a prescribes (the stock element previews on the real page and stacks chips one per line); the stock element is used only for wallpaper and updates, created with `setAttribute` (React 19 breaks `sections=` in JSX). No layouts. Fonts are bundled: `apps/web/scripts/gen-fonts.mjs` writes `src/fonts.css` from the fonts the installed styles ask for (plus Inter and Cantarell), and the engine runs with `fonts: 'none'`. |
| `guides-and-docs` | `apps/web/src/lib/{guides,markdown}.ts`, `components/GuidesTab.tsx`, `docs/` | Plain `<select>` instead of the engine's `Select` component. |
| `gpu-modes` | `apps/electron/src/{graphics,gpuModes}.ts` | identical to the engine. |
| `logos` | `scripts/gen-icons.mjs`, `scripts/logo/`, `branding/logo.json`, `branding/emblems/doc.json` | identical scripts; our emblem is `doc` (a page with a diagonal cut and three text lines) in teal `#1fc8a9`. All icons (`apps/web/public/icon*.svg/png`, `apps/electron/build/icon*.png`) are generated: edit `branding/logo.json` and run `CHROMIUM=<chromium> PLAYWRIGHT_MODULE=<playwright index.mjs> node scripts/gen-icons.mjs --png --sheet sheet.png`, look at the sheet, commit. Never edit an icon by hand. |
| `system-fonts` | `apps/web/src/lib/systemFonts.ts` (+ `test/systemFonts.test.ts`), `lib/fontList.ts`, `components/FontBox.tsx` | `systemFonts.ts` is the engine's file unchanged. `fontList.ts` starts detection (Electron needs no prompt; a browser only when already allowed) and shares the result with React; `FontBox` is the font picker of Docs, Sheets and Slides: built-in document fonts first, then the installed ones with a search box and "Show more", each name drawn in its own font, ⚠ when a document names a font this device lacks, any typed name accepted. |
| `motion` | `apps/web/src/motion.css`, `lib/arrivals.ts` | The engine's files. Used: `tk-swap` on every page change and on the slide you switch to, `tk-pop` on dialogs, menus and popovers, `tk-fade` (our own, in `index.css`) on dialog backdrops and slides in the show, `tk-slide-in` for the tabs panel, `tk-expand` for the banners, `tk-arrive` (through `useArrivals`) for recent files and new slides. `item-motion.css`, `Divider`, `AutoText`, `focus.ts`, `fresh.ts` are not used. Settings › Documents › Animations sets `data-motion="off"` on `<html>`, which `index.css` turns into no animation. |
| `window-frame` | `apps/electron/src/{main,preload,desktopConfig,graphics,gpuModes}.ts`, `components/WindowFrame.tsx` | `main.ts` rewritten: no library server, no Discord, no Cloudflare Access. IPC names are `turbodocs:*`, the bridge is `window.turbodocsDesktop`. |
| `editions`, `settings-shell`, `android-shell`, `discord-presence`, `cloudflare-access`, `device-pairing`, `termux-server`, `self-hosted-server`, `server-install-update`, `docker-self-host` | not used | TurboDocs has app modules instead of editions (see below). |

## The TurboDocs palettes
`themes/turbodocs/` in the engine (a dark and a light palette, `group: own`, each the other's `pair`) is the app's own pair: the logo's teal on a near-black with a hint of the same hue, and a deeper teal on paper white. `lib/appearance.ts` makes them the first-run look (the light one on a light device); the stock engine tests list them in the picker's "own" group.

## TurboDocs' own: app modules
`apps/electron/src/modules.ts` is the registry (id, title, extensions, `available`). `desktop.json` stores which are installed. `main.ts` routes a file to its module by extension from Open, from the command line and from the OS (`open-file` on macOS, `second-instance` argv elsewhere) and tells the page (`turbodocs:open`). Installing a module today only flips a flag; real installation (downloading code, per-module file associations) is not designed yet.

## What each app is built from
- **Docs:** TipTap (ProseMirror) for editing; our own importer and exporter (`editor/docxImport.ts`, `docxExport.ts` on the `docx` library, plus `patchCrops` for picture crops). Extras: `editor/tabs.ts` (document tabs), `ImageView.tsx`, `typing.ts`, `toMarkdown.ts`, `emoji.ts`, `docMenus.ts`.
- **Sheets:** no library for the file formats. `sheets/xlsx.ts` reads and writes the workbook XML with JSZip and `@xmldom/xmldom`; `csv.ts`, `format.ts` (number and date formats), `ops.ts` (pure edits, all tested), `Grid.tsx` (windowed grid: only the visible cells exist in the DOM), `SheetPane.tsx`.
- **Slides:** `slides/pptx.ts` reads the presentation XML itself (layout, master and theme inheritance for position, size, font, colour and bullets) and writes with `pptxgenjs` (loaded when the first deck is saved). `SlideCanvas.tsx` (move, resize, in-place rich text via `contentEditable`, read back by `rich.tsx` from the browser's computed styles), `Present.tsx`, `SlidesPane.tsx`.
- Shared: `components/{MenuBar,Dialog,FontBox}.tsx`, `lib/history.ts` (undo for Sheets and Slides), `editor/useSaver.ts` and `useAutosave.ts` (save, backups, crash recovery for all three), `lib/docPrefs.ts`.

## Taking improvements back
If a fix here belongs in an engine module, copy it into `modules/<m>/files/...` in the engine and add a line to its `MODULE.md` (see the engine's `CLAUDE.md`).
