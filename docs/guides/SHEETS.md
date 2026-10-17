# Sheets

Sheets opens, edits and saves `.xlsx` workbooks and `.csv` tables. It is deliberately basic: values, text, formats and several sheets. **Formulas are not calculated** (see below).

## Working in the grid
- Click a cell and type; **Enter** goes down, **Tab** right, **Esc** cancels. **F2** or a double-click edits the cell you are on; the formula bar above the grid edits it too. **Alt+Enter** starts a new line inside a cell.
- Arrow keys move; **Shift+arrows** select a range; **Ctrl+arrows** jump to the edge of the data; click a column or row header to select all of it, drag its edge to resize it.
- **Delete** clears values and keeps formats (Edit › Clear values and formats clears both). **Ctrl+D / Ctrl+R** fill down and right. Copy, cut and paste work inside the grid and with other programs (tab-separated text).
- Typing `12`, `1,234.5`, `25%`, `TRUE` or `2026-12-25` makes a number, a percentage, a yes/no or a date; anything else is text. Select several cells and the status bar shows their sum, average and count.
- **Format:** font, size, bold, italic, underline, text and fill colour, alignment, wrap text, number format (number, percent, currency, date, time, scientific, text), merge cells. **Data:** sort by a column (A to Z or Z to A), optionally leaving a header row. **Insert:** rows and columns, new sheets (double-click a sheet tab to rename it, right-click to delete it).

## Formulas
Formulas in a file you open are **kept**: TurboDocs shows the value the file last had and writes the formula back unchanged. It cannot recalculate them yet, so if you change a cell a formula uses, the shown value is stale until Excel or LibreOffice opens the file and recalculates it. A formula you type (`=B2*2`) is saved as a formula with no value yet and shown as its text in italics; Excel and LibreOffice calculate it when they open the file.

## What is kept
Values, text, numbers, yes/no, error values, dates, number formats, fonts, bold / italic / underline, colours, fills, alignment, wrap, column widths, row heights, merged cells, several sheets and the sheet names. Not kept (and you are told when you open such a file): charts and pictures, pivot tables, conditional formatting, data-validation lists, hyperlinks (the text stays), Excel tables as tables, frozen panes, comments and macros. The first **Save** over such a file asks you to agree; **Save as** keeps the original untouched. A copy of the original also goes to the app's `backups` folder before it is replaced.

## CSV
A `.csv` file is one sheet. The separator (comma, semicolon, tab or bar) is detected, every value stays exactly the text it is in the file (`007` and `1.50` are saved as they were), and the line endings and a leading byte-order mark are kept. File › **Save a copy as .xlsx** converts it; for an `.xlsx`, File › **Save this sheet as .csv** writes the open sheet.
