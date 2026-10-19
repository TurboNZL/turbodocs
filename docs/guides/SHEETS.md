# Sheets

Sheets opens, edits and saves `.xlsx` workbooks and `.csv` tables. It covers the everyday things: values, text, formats, borders, frozen panes, charts, find and replace, several sheets. **Formulas are not calculated** (see below).

## Working in the grid
- Click a cell and type; **Enter** goes down, **Tab** right, **Esc** cancels. **F2** or a double-click edits the cell you are on; the formula bar above the grid edits it too. **Alt+Enter** starts a new line inside a cell.
- Arrow keys move; **Shift+arrows** select a range; **Ctrl+arrows** jump to the edge of the data; click a column or row header to select all of it, drag its edge to resize it.
- **Delete** clears values and keeps formats (Edit › Clear values and formats clears both). **Ctrl+D / Ctrl+R** fill down and right. Copy, cut and paste work inside the grid and with other programs (tab-separated text).
- Typing `12`, `1,234.5`, `25%`, `TRUE` or `2026-12-25` makes a number, a percentage, a yes/no or a date; anything else is text. Select several cells and the status bar shows their sum, average and count.
- **Format:** font, size, bold, italic, underline, text and fill colour, horizontal and vertical alignment, wrap text, **borders** (all, outer, inner, one side or none, with a line style and colour chosen beside the button), number format (number, percent, currency, date, time, scientific, text) with the $ and % buttons and more or fewer decimal places, merge cells. **Data:** sort by a column (A to Z or Z to A), optionally leaving a header row. **Insert:** rows and columns, new sheets (double-click a sheet tab to rename it, right-click to delete it).

## Fill handle, find and replace, right-click
- Select cells and drag the small square at the corner of the selection to fill: numbers that step evenly go on stepping (1, 3 gives 5, 7), a date goes on a day at a time, text ending in a number counts up (Item 1, Item 2 ...), anything else repeats. Formulas are copied as they are (TurboDocs does not shift their references).
- **Ctrl+F** (or Ctrl+H) opens find and replace: it finds what is typed in a cell or what the cell shows, in reading order, with *match case* and *whole cell*; **Enter** goes to the next match, *Replace all* changes every match in one step you can undo.
- **Right-click** a cell, a column header or a row header for cut, copy, paste, insert, delete, clear, sort and freeze.
- **View › Freeze** keeps the first rows and columns in view while you scroll (1 or 2 rows or columns, or up to the cell you are on). Frozen panes are saved in `.xlsx` files.

## Charts
**Insert › Chart** (or the chart button) turns the selected cells into a column, bar, line or pie chart; with one cell selected it takes the block of filled cells around it. It guesses whether the first row holds the series names and the first column the labels; the box lets you change that and the range. The chart floats over the grid: drag it to move, drag its corner to resize, double-click to change its type, title or data, **Delete** removes it. It always shows what is in the cells right now, and follows rows and columns you insert or delete. Charts are saved in `.xlsx` files (Excel and LibreOffice show them) and charts of those four kinds are read back; other kinds (area and scatter are shown as lines) are listed when you open the file.

## Formulas
Formulas in a file you open are **kept**: TurboDocs shows the value the file last had and writes the formula back unchanged. It cannot recalculate them yet, so if you change a cell a formula uses, the shown value is stale until Excel or LibreOffice opens the file and recalculates it. A formula you type (`=B2*2`) is saved as a formula with no value yet and shown as its text in italics; Excel and LibreOffice calculate it when they open the file.

## What is kept
Values, text, numbers, yes/no, error values, dates, number formats, fonts, bold / italic / underline, colours, fills, borders, alignment, wrap, column widths, row heights, merged cells, frozen panes, column / bar / line / pie charts, several sheets and the sheet names. Not kept (and you are told when you open such a file): other chart types, pictures, pivot tables, conditional formatting, data-validation lists, hyperlinks (the text stays), Excel tables as tables, comments and macros. The first **Save** over such a file asks you to agree; **Save as** keeps the original untouched. A copy of the original also goes to the app's `backups` folder before it is replaced.

## CSV
A `.csv` file is one sheet. The separator (comma, semicolon, tab or bar) is detected, every value stays exactly the text it is in the file (`007` and `1.50` are saved as they were), and the line endings and a leading byte-order mark are kept. File › **Save a copy as .xlsx** converts it; for an `.xlsx`, File › **Save this sheet as .csv** writes the open sheet.
