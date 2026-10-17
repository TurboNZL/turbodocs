# TurboDocs

Documents, spreadsheets and presentations as small apps (modules) that install into one themed desktop shell.

> **Status:** the shell works (window, themes, updates, Settings, module registry, offline fonts) and all three apps open, edit and save: **Docs** (`.docx`, `.md`, `.txt`; everything the original Python app did, see `docs/development/LEGACY_REFERENCE.md`), **Sheets** (`.xlsx`, `.csv`; basic, formulas are kept but not calculated) and **Slides** (`.pptx`; a plain editor with a full-screen show). What a save keeps and what it does not is in `docs/guides/`.

## Run it

```bash
pnpm install                       # Node 22+, pnpm 10
pnpm dev                           # the web client in a browser (http://localhost:5173)
pnpm start                         # build, then open the desktop app (Electron)
pnpm typecheck && pnpm test
pnpm --filter @turbodocs/electron dist:dir   # an unpacked build in apps/electron/release
```

`pnpm install` with `--ignore-scripts` (what CI does) skips the Electron binary download; run a normal `pnpm install` locally to get it.

## What is in here

```
apps/web        React + Vite + Tailwind client (themed by turbothemes)
apps/electron   the desktop shell: window, local server, updates, module registry, file opening
docs/guides     user guides (shown in Settings > Guides)
docs/development  internals
```

TurboDocs is built from [TurboNZL/turboengine](https://github.com/TurboNZL/turboengine): see `.turboengine.json` (the pinned commit and the modules used) and `docs/development/ENGINE.md`.

## Licence

MIT. See `LICENSE`.
