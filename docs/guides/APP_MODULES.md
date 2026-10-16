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
TurboDocs writes a *new* Word file from what you see in the editor. It keeps the document's own text styles (body font, size and line spacing; the Title, Subtitle and Heading 1 to 3 definitions) and its page size, orientation and margins. It keeps text, Title / Subtitle / Heading 1 to 3 (Heading 4 to 6 become Heading 3), bold, italic, underline, colour, highlight, font and size, alignment, line spacing, bulleted and numbered lists (nested), links, tables (merged cells, widths, cell colour) and pictures.

It does **not** keep, and tells you about when you open such a file: headers and footers, footnotes and endnotes, comments, text boxes, charts, equations, embedded objects, picture cropping, and the deleted text of tracked changes. Other style definitions (custom paragraph and character styles) are not kept; their formatting is kept as direct formatting where the editor can show it. If a file has any of these, the first **Save** asks you to agree; **Save as** keeps the original untouched.

## Markdown and text
`.md` and `.txt` files are edited as plain text and saved exactly as you see them (line endings kept). Markdown has a live preview beside the text; switch it off with the Preview box.

## New documents
**Home › New document** and **New Markdown** start an empty file; Save asks where to put it.

## Find and replace
Ctrl+F finds, Ctrl+H also replaces. Enter goes to the next match, Shift+Enter to the previous one, Esc closes the bar. **Aa** matches case; **.\*** treats what you type as a regular expression, and then `$1`, `$2` in the replacement stand for the groups of the match.

## Recent documents
Home lists the documents you opened or saved lately (name, how long ago, folder and the first words). A click opens it again; **Clear list** empties the list.

## Opening files from your file manager
Right-click a file › **Open with › TurboDocs** works for `.docx`, `.md` and `.txt` once TurboDocs is installed from the `.deb`. What a *double-click* opens is your system's default, and other programs (LibreOffice for `.docx`, text editors for `.txt`) may hold it: **Settings › Apps › Default applications** shows who does and makes TurboDocs the default with one click (Linux). On Windows use Settings › Apps › Default apps; on macOS use Get Info › Open with › Change All.

## Unsaved changes
A dot after the name means unsaved changes. Leaving the document (Home, Settings, opening another file, reloading) and closing the window ask first.
