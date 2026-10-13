# TurboDocs: project brief

The long-lived "why and what": goals, who it is for, rules the app must keep, architecture, roadmap with done-criteria. `CLAUDE.md` is the running log; this file changes rarely.

## Goal and user

One themed desktop app for reading and writing the documents people actually receive (.docx, .xlsx, .pptx, Markdown, CSV), built as small modules so each can be installed or removed, and every file opens in the right one. For the owner first; it should look like their other TurboNZL apps.

## Feature inventory

- Shell: themed window (turbothemes), Settings (Appearance, Apps, Guides, This app), self-update, optional theme-drawn title bar. Done.
- Module registry and file routing (Open, OS "Open with", command line). Done; modules themselves are not built.
- Docs, Sheets, Slides modules. Not started.

## Rules that must not be broken

- Colours, radii, fonts and motion come from the themes (hook classes and variables); the app only supplies structure and layout.
- Nothing destroys a user's file: no save path that silently drops content the editor cannot represent (images, charts, formulas).
- Updates never need root except the .deb path the updaters module already handles.

## Architecture

Electron main process (window, local static server on 127.0.0.1:47815, IPC, module registry, updater) + React client in the window. See `docs/development/ENGINE.md`.

## Roadmap (with done-criteria)

1. Module delivery design (see CLAUDE.md, open questions). Done when written down and agreed.
2. Docs viewer for .docx/.md/.txt. Done when real files from Word and LibreOffice open and look right.
3. Sheets viewer (cached values). 4. Slides viewer. 5. Editing, per module, only after its viewer is trusted.

## Glossary

**Module**: one app inside the shell (Docs, Sheets, Slides). **Shell**: the window, themes, Settings and updater. **Engine**: TurboNZL/turboengine, the reference the shell is built from.
