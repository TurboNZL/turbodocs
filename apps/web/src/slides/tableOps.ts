import { uid, type TableEl, type TCell } from './model.ts';

/** Pure edits of a table element (each returns a new one); rows and columns always add up to the frame. */
const sum = (a: number[]) => a.reduce((s, n) => s + n, 0);
const blank = (): TCell => ({ t: '' });

export function newTable(f: { x: number; y: number; w: number }, rows = 3, cols = 3, rowH = 48): TableEl {
  const cw = Math.round(f.w / cols);
  return { id: uid(), kind: 'table', x: f.x, y: f.y, w: cw * cols, h: rowH * rows, cols: Array(cols).fill(cw), rows: Array(rows).fill(rowH), cells: Array.from({ length: rows }, () => Array.from({ length: cols }, blank)), header: true, banded: true, accent: '#1f6f5c', border: '#b8bcc2' };
}
const withSize = (t: TableEl): TableEl => ({ ...t, w: sum(t.cols), h: sum(t.rows) });
export function insertRow(t: TableEl, at: number): TableEl {
  const i = Math.max(0, Math.min(t.rows.length, at)), h = t.rows[Math.min(i, t.rows.length - 1)] ?? 48;
  return withSize({ ...t, rows: [...t.rows.slice(0, i), h, ...t.rows.slice(i)], cells: [...t.cells.slice(0, i), t.cols.map(blank), ...t.cells.slice(i)] });
}
export function insertCol(t: TableEl, at: number): TableEl {
  const i = Math.max(0, Math.min(t.cols.length, at)), w = t.cols[Math.min(i, t.cols.length - 1)] ?? 120;
  return withSize({ ...t, cols: [...t.cols.slice(0, i), w, ...t.cols.slice(i)], cells: t.cells.map((r) => [...r.slice(0, i), blank(), ...r.slice(i)]) });
}
export function deleteRow(t: TableEl, at: number): TableEl {
  if (t.rows.length < 2) return t;
  return withSize({ ...t, rows: t.rows.filter((_, i) => i !== at), cells: t.cells.filter((_, i) => i !== at) });
}
export function deleteCol(t: TableEl, at: number): TableEl {
  if (t.cols.length < 2) return t;
  return withSize({ ...t, cols: t.cols.filter((_, i) => i !== at), cells: t.cells.map((r) => r.filter((_, i) => i !== at)) });
}
export function setCell(t: TableEl, r: number, c: number, patch: Partial<TCell>): TableEl {
  const cell: TCell = { ...t.cells[r][c], ...patch };
  for (const k of Object.keys(cell) as (keyof TCell)[]) if (cell[k] === undefined || cell[k] === false) delete cell[k];
  return { ...t, cells: t.cells.map((row, i) => (i === r ? row.map((x, j) => (j === c ? cell : x)) : row)) };
}
/** The table in a new frame: columns and rows scale with it. */
export function resizeTable(t: TableEl, w: number, h: number): TableEl {
  const kw = w / (sum(t.cols) || 1), kh = h / (sum(t.rows) || 1);
  const scale = (a: number[], k: number, min: number) => a.map((n) => Math.max(min, Math.round(n * k)));
  return withSize({ ...t, cols: scale(t.cols, kw, 20), rows: scale(t.rows, kh, 14) });
}
/** the fill a table row gets from the table's own style (header colour, banding) when a cell sets none */
export const cellTint = (t: TableEl, r: number, dark: boolean): string | undefined => (t.header && r === 0 ? t.accent : t.banded && (r - (t.header ? 1 : 0)) % 2 === 0 ? (dark ? '#2f3237' : '#eef0f2') : undefined);
