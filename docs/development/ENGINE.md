# How TurboDocs uses TurboEngine

Pinned in `.turboengine.json` (engine commit, modules used, what moved). The engine is a reference, not a dependency, except `turbothemes`, which is installed as a package: `git+https://github.com/TurboNZL/turboengine.git#path:/themes` (the `git+https` form so CI can clone it).

| Engine module | Where it lives here | Differences from the engine's copy |
|---|---|---|
| `release-pipeline` | `.github/workflows/` | Desktop only (no Android, no server editions); `auto-pr.yml` ignores `legacy/**`. |
| `updaters` | `apps/electron/src/{updater,updateErrors,debInstall}.ts`, `apps/web/src/components/AppSettings.tsx`, `lib/native.ts` | Renamed; Android parts and the Discord card dropped. The updater has not run against a real release yet. |
| `appearance` | `apps/web/src/lib/appearance.ts`, `components/AppearancePicker.tsx`, `tailwind.config.ts`, `index.css` | `persist: true`; the picker is our own on the headless controller, with the mock page and chip grid the engine's PICKER.md section 2a prescribes (the stock element previews on the real page and stacks chips one per line); the stock element is used only for wallpaper and updates, created with `setAttribute` (React 19 breaks `sections=` in JSX). No layouts. Fonts are bundled: `apps/web/scripts/gen-fonts.mjs` writes `src/fonts.css` from the fonts the installed styles ask for (plus Inter and Cantarell), and the engine runs with `fonts: 'none'`. |
| `guides-and-docs` | `apps/web/src/lib/{guides,markdown}.ts`, `components/GuidesTab.tsx`, `docs/` | Plain `<select>` instead of the engine's `Select` component. |
| `window-frame` | `apps/electron/src/{main,preload,desktopConfig,graphics,gpuModes}.ts`, `components/WindowFrame.tsx` | `main.ts` rewritten: no library server, no Discord, no Cloudflare Access. IPC names are `turbodocs:*`, the bridge is `window.turbodocsDesktop`. |
| `editions`, `settings-shell`, `android-shell` | not used | TurboDocs has app modules instead of editions (see below). |

## TurboDocs' own: app modules
`apps/electron/src/modules.ts` is the registry (id, title, extensions, `available`). `desktop.json` stores which are installed. `main.ts` routes a file to its module by extension from Open, from the command line and from the OS (`open-file` on macOS, `second-instance` argv elsewhere) and tells the page (`turbodocs:open`). Installing a module today only flips a flag; real installation (downloading code, per-module file associations) is not designed yet.

## Taking improvements back
If a fix here belongs in an engine module, copy it into `modules/<m>/files/...` in the engine and add a line to its `MODULE.md` (see the engine's `CLAUDE.md`).
