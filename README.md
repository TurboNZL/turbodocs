# TurboDocs

Documents, spreadsheets and presentations as small apps (modules) that install into one themed desktop shell.

> **Status:** the shell works (window, themes, updates, Settings, module registry, offline fonts) and **Docs edits and saves `.docx`, `.md` and `.txt`** (see `docs/guides/APP_MODULES.md` for what a Word save keeps). Sheets and Slides are not built. Layout and intent follow the original Python app: `docs/development/LEGACY_REFERENCE.md`.

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
