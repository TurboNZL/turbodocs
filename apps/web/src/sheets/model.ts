/**
 * The spreadsheet in memory. Cells are sparse (`"row,col"`, both from 0). Values are what the file holds; `f` is a formula's text, kept so that a save writes it
 * back (TurboDocs does not calculate formulas yet: it shows the value the file last had).
 */
/** one side of a cell's border: the line style and its colour */
export interface Edge { st: 'thin' | 'medium' | 'thick' | 'dashed' | 'dotted' | 'double'; c: string }
export interface Borders { t?: Edge; b?: Edge; l?: Edge; r?: Edge }
export interface CellFmt {
  b?: boolean; i?: boolean; u?: boolean; /** strikethrough */ st?: boolean; color?: string; fill?: string; align?: 'left' | 'center' | 'right'; /** vertical alignment (bottom is the spreadsheet default) */ va?: 'top' | 'middle' | 'bottom'; font?: string; size?: number; /** number format code, as in the file ("0.00", "0%", "yyyy-mm-dd") */ nf?: string; wrap?: boolean; bd?: Borders;
}
export type CellValue = string | number | boolean | null;
export interface Cell { v: CellValue; f?: string; /** an error value such as #DIV/0! (kept as text in `v`) */ err?: boolean; s?: CellFmt; /** a hyperlink (http, https or mailto) */ link?: string }
/** nothing in it worth keeping */
export const isEmptyCell = (c: Cell): boolean => c.v === null && !c.s && c.f === undefined && !c.link;
export interface Range { r1: number; c1: number; r2: number; c2: number }
export interface Sheet {
  name: string; cells: Record<string, Cell>;
  /** column widths and row heights in px, only where they differ from the default */
  colW: Record<number, number>; rowH: Record<number, number>; merges: Range[];
  /** frozen rows and columns: they stay in view while the rest scrolls (xlsx only) */
  freeze?: { rows: number; cols: number };
  charts?: Chart[];
  cf?: CfRule[]; dv?: Validation[]; filter?: Filter;
}
/** Conditional formatting: a rule colours the cells of its range that match (`scale` shades numbers from `lo` to `hi`). */
export interface CfRule { id: string; range: Range; kind: 'gt' | 'ge' | 'lt' | 'le' | 'eq' | 'ne' | 'between' | 'text' | 'blank' | 'notblank' | 'scale'; v1?: string; v2?: string; fill?: string; color?: string; bold?: boolean; lo?: string; hi?: string }
/** Data validation: what may be typed into the cells of a range (a list, whole numbers or decimals; `source` is a range of cells holding the list). */
export interface Validation { range: Range; kind: 'list' | 'whole' | 'decimal'; items?: string[]; source?: string; min?: number; max?: number; blank: boolean; message?: string }
/** A filter on a block of cells: the first row holds the headings, `show` lists the texts a column may have (a column not in it shows everything). */
export interface Filter { range: Range; show: Record<number, string[]> }
export type ChartType = 'column' | 'bar' | 'line' | 'area' | 'scatter' | 'pie';
/**
 * A chart floating over a sheet. Its data is a block of cells (`range`): with `header` the first row names the series, with `labels` the first column names the
 * categories, every other column is a series. `x y w h` are px on the sheet (like the grid itself, not the window).
 */
export interface Chart { id: string; type: ChartType; title: string; range: Range; header: boolean; labels: boolean; x: number; y: number; w: number; h: number }
export interface Workbook { sheets: Sheet[]; active: number; /** csv only */ delimiter?: string }

export const DEFAULT_COL_W = 96, DEFAULT_ROW_H = 24, MIN_ROWS = 100, MIN_COLS = 26;

/** a cell's text as it is edited: a formula as "=…", anything else as it would be typed */
export const cellText = (cell: Cell | undefined): string => (cell?.f !== undefined ? `=${cell.f}` : cell?.v === null || cell?.v === undefined ? '' : typeof cell.v === 'boolean' ? (cell.v ? 'TRUE' : 'FALSE') : String(cell.v));

export const key = (r: number, c: number) => `${r},${c}`;
export const unkey = (k: string): [number, number] => { const i = k.indexOf(','); return [Number(k.slice(0, i)), Number(k.slice(i + 1))]; };
export function colName(c: number): string { let s = ''; for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; }
export function colIndex(name: string): number { let n = 0; for (const ch of name.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }
export const addr = (r: number, c: number) => `${colName(c)}${r + 1}`;
export function parseAddr(a: string): [number, number] | null { const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(a.trim()); return m ? [Number(m[2]) - 1, colIndex(m[1])] : null; }
export function parseRange(a: string): Range | null {
  const [x, y] = a.split(':'); const p = parseAddr(x), q = parseAddr(y ?? x);
  return p && q ? { r1: Math.min(p[0], q[0]), c1: Math.min(p[1], q[1]), r2: Math.max(p[0], q[0]), c2: Math.max(p[1], q[1]) } : null;
}
export const rangeText = (g: Range) => (g.r1 === g.r2 && g.c1 === g.c2 ? addr(g.r1, g.c1) : `${addr(g.r1, g.c1)}:${addr(g.r2, g.c2)}`);
export const norm = (a: { r: number; c: number }, b: { r: number; c: number }): Range => ({ r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c), r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c) });

export const emptySheet = (name: string): Sheet => ({ name, cells: {}, colW: {}, rowH: {}, merges: [] });
export const newWorkbook = (): Workbook => ({ sheets: [emptySheet('Sheet1')], active: 0 });

/** the used area: rows and columns that hold anything (at least the default grid is drawn around it) */
export function extent(s: Sheet): { rows: number; cols: number } {
  let rows = 0, cols = 0;
  for (const k of Object.keys(s.cells)) { const [r, c] = unkey(k); if (r + 1 > rows) rows = r + 1; if (c + 1 > cols) cols = c + 1; }
  for (const m of s.merges) { rows = Math.max(rows, m.r2 + 1); cols = Math.max(cols, m.c2 + 1); }
  return { rows, cols };
}

/** what typing into a cell means: nothing, a number, TRUE/FALSE, or text */
export function parseInput(text: string, typed: boolean): CellValue {
  const t = text.trim();
  if (text === '') return null;
  if (!typed) return text;
  if (/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t) && !/^[-+]?0\d/.test(t) && t.replace(/\D/g, '').length <= 15) return Number(t);
  if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) return Number(t.replace(/,/g, ''));
  const pct = /^([-+]?\d+(\.\d+)?)%$/.exec(t);
  if (pct) return Number(pct[1]) / 100;
  if (/^true$/i.test(t)) return true;
  if (/^false$/i.test(t)) return false;
  return text;
}
export const isNumeric = (v: CellValue): boolean => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(v.trim()));
export const numberOf = (v: CellValue): number | null => (typeof v === 'number' ? v : isNumeric(v) ? Number((v as string).trim()) : null);

/** where a column starts and a row starts on the sheet, in px */
export const colLeft = (s: Sheet, c: number): number => { let x = 0; for (let i = 0; i < c; i++) x += s.colW[i] ?? DEFAULT_COL_W; return x; };
export const rowTop = (s: Sheet, r: number): number => { let y = 0; for (let i = 0; i < r; i++) y += s.rowH[i] ?? DEFAULT_ROW_H; return y; };
/** the column and row at a px position, with how far into it (the inverse of `colLeft` and `rowTop`) */
export function cellAtPx(s: Sheet, x: number, y: number): { r: number; c: number; dx: number; dy: number } {
  let c = 0, left = 0, w = s.colW[0] ?? DEFAULT_COL_W; while (left + w <= x && c < 16383) { left += w; c++; w = s.colW[c] ?? DEFAULT_COL_W; }
  let r = 0, top = 0, h = s.rowH[0] ?? DEFAULT_ROW_H; while (top + h <= y && r < 1048575) { top += h; r++; h = s.rowH[r] ?? DEFAULT_ROW_H; }
  return { r, c, dx: Math.max(0, x - left), dy: Math.max(0, y - top) };
}
