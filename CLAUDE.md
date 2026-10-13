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
| Themes | turbothemes (in the engine repo) for the look, because the owner wants every project to look consistent. Stock `<turbo-themes-picker>`, one side-bar layout for now. |
| Repos | One repo for now. Separate repos only if the modules need separate installers; keep module code behind the registry so that stays possible. |

## Repo layout
```
apps/web        React client (pages: Home, Settings; components: Layout, WindowFrame, AppsTab, GuidesTab, AppSettings, ThisApp)
apps/electron   main.ts (window, IPC, file opening), modules.ts (registry), desktopConfig.ts, staticServer.ts, updater*.ts, graphics/gpuModes.ts, preload.ts
docs/guides     user guides (bundled into Settings > Guides)    docs/development  internals
.github/workflows  release (vYYYY.M.N on every merge to main), check, auto-pr
```

## What exists and is tested
- Verified in a real Chromium (headless, built client): the themed shell renders, `<turbo-themes-picker>` registers and lists palettes and styles, a chosen look (Nord + Windows 11) survives a reload, the Settings tabs render. Typecheck and build of both packages pass.
- Verified in the real Electron binary under Xvfb (software rendering): window opens, the client loads from 127.0.0.1:47815, the preload bridge and IPC answer (modules, updates = disabled in a dev run, graphics), and a second launch with a file path (`electron . file.docx`) forwards it to the running window, which lists it with the module it needs.
- NOT verified: the self-updater against a real release (no release exists yet), the .deb/AppImage/NSIS packaging (never built here), CI workflows (never run), custom window frame in a real window, Wayland/GPU paths, macOS.

## Hard-won gotchas
- `pnpm install --ignore-scripts` (CI) skips the Electron binary: run a plain `pnpm install` locally.
- turbothemes must be installed as `git+https://github.com/TurboNZL/turboengine.git#path:/themes`; the `github:` shorthand records an SSH address CI cannot clone.
- pnpm writes the turbothemes entry in `pnpm-lock.yaml` as an SSH address (`git@github.com:...`) even from the `git+https` specifier; it was edited by hand to the https form (frozen install re-verified). After any `pnpm add`/`update` that touches the lockfile, check those three lines again.
- The window loads the client from `http://127.0.0.1:47815` (fixed port) so its storage keeps the user's look. Change it only with `TURBODOCS_DESKTOP_PORT`.
- `auto-pr.yml` ignores `legacy/**` so the legacy branch never gets a PR against main.

- A second launch must not start up: `app.quit()` is asynchronous, so without the `primary` guard in `main.ts` the second process found the port taken and opened an unclosable error dialog. The engine's `window-frame/main.ts` has the same pattern and should get the same guard.
- The "Automatic" graphics mode relaunches the app up to five times when there is no GPU (a headless sandbox): set `TURBODOCS_SOFTWARE_RENDERING=1` when driving the app from a script.

## Open questions / next
1. Module delivery: how does "install Sheets" get code into the app (download a bundle from releases? separate installers that register with the shell?) and how do file associations follow install/uninstall? Needs a design before any module is built.
2. First real module: Docs (.docx via a JS library; round-trip fidelity is the risk). Sheets: viewer first (formulas need a calc engine). Slides: rendering is the hard part.
3. Bundle fonts for offline use (`fonts: 'none'` + @fontsource) and an app icon PNG (build/icon.png is generated from icon.svg, see below).
4. Layouts (where pages are listed) are the app's job; only a side bar exists.

## Session log
- 2026-10-13 (engine fix to port back): `primary` single-instance guard in `apps/electron/src/main.ts`.
- 2026-10-13: Rewrote the repo on TurboEngine (engine at 6b26f24). Moved the Python app to `legacy/python`. Added the shell, module registry and engine modules as described in `docs/development/ENGINE.md`.
