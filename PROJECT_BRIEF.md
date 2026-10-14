# TurboDocs: project brief

The long-lived "why and what": goals, who it is for, rules the app must keep, architecture, roadmap with done-criteria. `CLAUDE.md` is the running log; this file changes rarely.

## Goal and user

One themed desktop app for reading and writing the documents people actually receive (.docx, .xlsx, .pptx, Markdown, CSV), built as small modules so each can be installed or removed, and every file opens in the right one. For the owner first; it should look like their other TurboNZL apps.

## Feature inventory

- Shell: themed window (turbothemes), Settings (Appearance, Apps, Guides, This app), self-update, optional theme-drawn title bar. Done.
- Module registry and file routing (Open, OS "Open with", command line). Done; modules themselves are not built.
- Docs module: view and edit `.docx`, `.md`, `.txt`; save with a backup of the original; unsaved-changes guards. Done, with the gaps listed in `docs/development/LEGACY_REFERENCE.md` (menu bar, find/replace, document tabs, image resize/crop, crash backups, recent documents). Sheets and Slides: not started.

## Reference: the original app
The editor copies the intent and layout of the first TurboDocs (Python/Qt, branch `legacy/python`). Real screenshots of it, taken by running that branch, and a full write-up (menus, toolbar order, status bar, dashboard, paragraph style values, shortcuts, what is and is not ported yet) are in `docs/development/LEGACY_REFERENCE.md`. In short: a **pageless** canvas on the theme's own background (a ~760 px centred column, adjustable), one formatting toolbar (undo/redo, style, font, size, B/I/U, split text-colour and highlight buttons, align, spacing, lists, indent, link/image/table/emoji, a Width button), a status bar with word count and a zoom slider, a floating tabs button, a dashboard of recent documents, and a promise that nothing is lost silently. Compare any editor change with those screenshots before calling it done.

## Rules that must not be broken

- Colours, radii, fonts and motion come from the themes (hook classes and variables); the app only supplies structure and layout.
- Colour themes and UI styles are never previewed by restyling the real page on hover; the picker uses the mock page (engine `docs/PICKER.md`, section 2a), and colour chips are a multi-column grid.
- Nothing destroys a user's file: no save path that silently drops content the editor cannot represent (images, charts, formulas).
- Updates never need root except the .deb path the updaters module already handles.

## Architecture

Electron main process (window, local static server on 127.0.0.1:47815, IPC, module registry, updater) + React client in the window. See `docs/development/ENGINE.md`.

## Roadmap (with done-criteria)

1. Module delivery design (see CLAUDE.md, open questions). Done when written down and agreed.
2. Docs: open, edit and save .docx/.md/.txt. Done for the basics; "done" for fidelity needs real Word-authored files (only python-docx and LibreOffice files were tried).
3. Close the gaps to the original app (LEGACY_REFERENCE.md), most valuable first: Find and replace, menu bar, recent documents, crash backups.
4. Sheets viewer (cached values), then Slides viewer; editing only after a viewer is trusted.

## Glossary

**Module**: one app inside the shell (Docs, Sheets, Slides). **Shell**: the window, themes, Settings and updater. **Engine**: TurboNZL/turboengine, the reference the shell is built from.
