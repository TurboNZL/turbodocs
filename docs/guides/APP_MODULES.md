# App modules and file types

TurboDocs is one shell with separate apps inside it:

| Module | Opens |
|---|---|
| Docs | `.docx`, `.md`, `.markdown`, `.txt` |
| Sheets | `.xlsx`, `.csv` |
| Slides | `.pptx` |

**Settings › Apps** is where a module is installed or removed. A file is handed to the module for its type, whichever way you open it: the Open button, or "Open with TurboDocs" from your file manager.

**What exists today:** Docs opens, edits and saves `.docx`, `.md` and `.txt`. Sheets opens, edits and saves `.xlsx` and `.csv` ([Sheets](SHEETS.md)). Slides opens, edits and saves `.pptx` ([Slides](SLIDES.md)). All three are installed by default; keyboard shortcuts are in [Shortcuts](SHORTCUTS.md).

## Editing a Word document
- The page has no sheet of paper: the text sits on the theme's background in a column whose width you set with **Width**. Zoom with the slider or Ctrl + mouse wheel.
- The menu bar (File, Edit, View, Insert, Format, Tools) holds everything; the toolbar under it has the usual ones: undo and redo, paragraph style (Normal, Title, Subtitle, Heading 1 to 3), font, size, bold, italic, underline, text colour, highlight, alignment, line spacing, lists and indent, link, emoji, image, table. The two colour buttons apply the last colour; the small arrow opens the palette and your recent custom colours.
- **Fonts:** the font box lists the fonts installed on this computer (search it, or type any name). A font a document names that this computer lacks is marked ⚠ and drawn with a stand-in; the file still says the right font.
- **Width** (Ctrl+Alt+W) sets the text width and the left and right margins.
- **Pictures:** click one to select it and drag a corner to resize. Double-click (or Format › Image › Crop) to crop: drag the four edges, then **Crop**. A crop is saved the way Word saves one, so it can be undone later in Word too. Format › Image › Original size / Reset size.
- **Document tabs** (☰ at the top left, or View › Document tabs): split one document into tabs and open them one at a time, with an outline of the headings under them. In the file each tab is a title line wrapped in a bookmark, so Word shows an ordinary document.
- **Markdown view** (View › Markdown view): a plain-text rendering of the document. Ctrl+S there saves a `.md` file; the Word document is never touched.
- **Word count** (Ctrl+Shift+C), **Insert › Emoji** and `:smile:` shortcodes, **Insert › Date and time**, **Edit › Paste as plain text**, **Format › Page colour**.
- **Paragraph styles:** Format › Paragraph styles › *Update "Heading 1" to match selection* changes the style itself; *Save these styles as my defaults* makes them the start for new documents.
- **Never lose work:** a copy of the unsaved document is kept 1.5 seconds after you stop typing (Settings › Documents changes the delay). If the app closes unexpectedly, the next time you open the file it offers the copy back. File › Reset session edits goes back to the saved file.
- **Save** (Ctrl+S) writes the file; **Save as** (Ctrl+Shift+S) writes a new one and leaves the original alone. Before any file is overwritten, a copy goes to the app's `backups` folder (the last 60 are kept).
- **Original view** shows the saved file the way Word draws it, read-only.

### What is kept, and what is not
TurboDocs writes a *new* Word file from what you see in the editor. It keeps the document's own text styles (and page colour) (body font, size and line spacing; the Title, Subtitle and Heading 1 to 3 definitions) and its page size, orientation and margins. It keeps text, Title / Subtitle / Heading 1 to 3 (Heading 4 to 6 become Heading 3), bold, italic, underline, colour, highlight, font and size, alignment, line spacing, bulleted and numbered lists (nested), links, tables (merged cells, widths, cell colour) and pictures (with their crop).

It does **not** keep, and tells you about when you open such a file: headers and footers, footnotes and endnotes, comments, text boxes, charts, equations, embedded objects, and the deleted text of tracked changes. Other style definitions (custom paragraph and character styles) are not kept; their formatting is kept as direct formatting where the editor can show it. If a file has any of these, the first **Save** asks you to agree; **Save as** keeps the original untouched.

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
