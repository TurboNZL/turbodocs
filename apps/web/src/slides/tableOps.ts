import { uid, type TableEl, type TCell, type TMerge } from './model.ts';

/** Pure edits of a table element (each returns a new one); rows and columns always add up to the frame. */
const sum = (a: number[]) => a.reduce((s, n) => s + n, 0);
const blank = (): TCell => ({ t: '' });

export function newTable(f: { x: number; y: number; w: number }, rows = 3, cols = 3, rowH = 48): TableEl {
  const cw = Math.round(f.w / cols);
  return { id: uid(), kind: 'table', x: f.x, y: f.y, w: cw * cols, h: rowH * rows, cols: Array(cols).fill(cw), rows: Array(rows).fill(rowH), cells: Array.from({ length: rows }, () => Array.from({ length: cols }, blank)), header: true, banded: true, accent: '#1f6f5c', border: '#b8bcc2' };
}
const withSize = (t: TableEl): TableEl => ({ ...t, w: sum(t.cols), h: sum(t.rows) });
/** merges after a row (axis 'r') or column ('c') was inserted at `at`, or deleted */
function moveMerges(ms: TMerge[] | undefined, axis: 'r' | 'c', change: { insert: number } | { remove: number }): TMerge[] | undefined {
  if (!ms?.length) return ms;
  const [p, n] = axis === 'r' ? (['r', 'rs'] as const) : (['c', 'cs'] as const);
  const out: TMerge[] = [];
  for (const m of ms) {
    const o = { ...m };
    if ('insert' in change) { const at = change.insert; if (o[p] >= at) o[p]++; else if (o[p] + o[n] > at) o[n]++; }
    else { const at = change.remove; if (o[p] === at && o[n] > 1) { o[n]--; } else if (o[p] === at) continue; else if (o[p] > at) o[p]--; else if (o[p] + o[n] > at) o[n]--; }
    if (o.rs > 1 || o.cs > 1) out.push(o);
  }
  return out.length ? out : undefined;
}
const withMerges = (t: TableEl, merges: TMerge[] | undefined): TableEl => { const o = { ...t }; if (merges?.length) o.merges = merges; else delete o.merges; return o; };
export function insertRow(t: TableEl, at: number): TableEl {
  const i = Math.max(0, Math.min(t.rows.length, at)), h = t.rows[Math.min(i, t.rows.length - 1)] ?? 48;
  return withMerges(withSize({ ...t, rows: [...t.rows.slice(0, i), h, ...t.rows.slice(i)], cells: [...t.cells.slice(0, i), t.cols.map(blank), ...t.cells.slice(i)] }), moveMerges(t.merges, 'r', { insert: i }));
}
export function insertCol(t: TableEl, at: number): TableEl {
  const i = Math.max(0, Math.min(t.cols.length, at)), w = t.cols[Math.min(i, t.cols.length - 1)] ?? 120;
  return withMerges(withSize({ ...t, cols: [...t.cols.slice(0, i), w, ...t.cols.slice(i)], cells: t.cells.map((r) => [...r.slice(0, i), blank(), ...r.slice(i)]) }), moveMerges(t.merges, 'c', { insert: i }));
}
export function deleteRow(t: TableEl, at: number): TableEl {
  if (t.rows.length < 2) return t;
  return withMerges(withSize({ ...t, rows: t.rows.filter((_, i) => i !== at), cells: t.cells.filter((_, i) => i !== at) }), moveMerges(t.merges, 'r', { remove: at }));
}
export function deleteCol(t: TableEl, at: number): TableEl {
  if (t.cols.length < 2) return t;
  return withMerges(withSize({ ...t, cols: t.cols.filter((_, i) => i !== at), cells: t.cells.map((r) => r.filter((_, i) => i !== at)) }), moveMerges(t.merges, 'c', { remove: at }));
}
/** the merge a cell belongs to (as its first cell or as one it covers) */
export const mergeOf = (t: TableEl, r: number, c: number): TMerge | undefined => t.merges?.find((m) => r >= m.r && r < m.r + m.rs && c >= m.c && c < m.c + m.cs);
export const isCovered = (t: TableEl, r: number, c: number): boolean => { const m = mergeOf(t, r, c); return !!m && (m.r !== r || m.c !== c); };
/** Join the cell at (r, c) with the one to its right or below (the text of the covered cells joins the first). */
export function mergeNext(t: TableEl, r: number, c: number, dir: 'right' | 'down'): TableEl {
  const m = mergeOf(t, r, c) ?? { r, c, rs: 1, cs: 1 };
  const next = { ...m, ...(dir === 'right' ? { cs: m.cs + 1 } : { rs: m.rs + 1 }) };
  if (next.c + next.cs > t.cols.length || next.r + next.rs > t.rows.length) return t;
  // anything the grown merge swallows that is merged itself is taken over
  const swallowed = (x: TMerge) => x !== m && x.r >= next.r && x.c >= next.c && x.r < next.r + next.rs && x.c < next.c + next.cs;
  const others = (t.merges ?? []).filter((x) => x !== m && !swallowed(x));
  if (others.some((x) => !(x.r + x.rs <= next.r || x.r >= next.r + next.rs || x.c + x.cs <= next.c || x.c >= next.c + next.cs))) return t;
  const texts: string[] = [];
  for (let i = next.r; i < next.r + next.rs; i++) for (let j = next.c; j < next.c + next.cs; j++) if (t.cells[i][j].t) texts.push(t.cells[i][j].t);
  const cells = t.cells.map((row, i) => row.map((cell, j) => (i === next.r && j === next.c ? { ...cell, t: texts.join(' ') } : i >= next.r && i < next.r + next.rs && j >= next.c && j < next.c + next.cs ? { t: '' } : cell)));
  return { ...t, cells, merges: [...others, next] };
}
export function unmerge(t: TableEl, r: number, c: number): TableEl { const m = mergeOf(t, r, c); return m ? withMerges(t, t.merges!.filter((x) => x !== m)) : t; }
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
