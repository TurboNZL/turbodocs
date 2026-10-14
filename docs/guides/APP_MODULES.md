# App modules and file types

TurboDocs is one shell with separate apps inside it:

| Module | Opens |
|---|---|
| Docs | `.docx`, `.md`, `.markdown`, `.txt` |
| Sheets | `.xlsx`, `.csv` |
| Slides | `.pptx` |

**Settings › Apps** is where a module is installed or removed. A file is handed to the module for its type, whichever way you open it: the Open button, or "Open with TurboDocs" from your file manager.

**What exists today:** Docs opens, edits and saves `.docx`, `.md` and `.txt`. Sheets and Slides are planned and cannot be installed.

## Editing a Word document
- The page has no sheet of paper: the text sits on the theme's background in a column whose width you set with **Width**. Zoom with the slider or Ctrl + mouse wheel.
- The toolbar: undo and redo, paragraph style (Normal, Title, Subtitle, Heading 1 to 3), font, size, bold, italic, underline, text colour, highlight, alignment, line spacing, lists and indent, link, image, table. The two colour buttons apply the last colour; the small arrow opens the palette.
- **Save** (Ctrl+S) writes the file; **Save as** (Ctrl+Shift+S) writes a new one and leaves the original alone. Before any file is overwritten, a copy goes to the app's `backups` folder (the last 60 are kept).
- **Original view** shows the saved file the way Word draws it, read-only.

### What is kept, and what is not
TurboDocs writes a *new* Word file from what you see in the editor. It keeps text, Title / Subtitle / Heading 1 to 3 (Heading 4 to 6 become Heading 3), bold, italic, underline, colour, highlight, font and size, alignment, line spacing, bulleted and numbered lists (nested), links, tables (merged cells, widths, cell colour) and pictures.

It does **not** keep, and tells you about when you open such a file: headers and footers, footnotes and endnotes, comments, text boxes, charts, equations, embedded objects, picture cropping, and the deleted text of tracked changes. Page size, margins and the file's own style definitions are not kept either (the new file uses Calibri 11 pt and the styles above). If a file has any of these, the first **Save** asks you to agree; **Save as** keeps the original untouched.

## Markdown and text
`.md` and `.txt` files are edited as plain text and saved exactly as you see them (line endings kept). Markdown has a live preview beside the text; switch it off with the Preview box.

## New documents
**Home › New document** and **New Markdown** start an empty file; Save asks where to put it.

## Unsaved changes
A dot after the name means unsaved changes. Leaving the document (Home, Settings, opening another file, reloading) and closing the window ask first.
