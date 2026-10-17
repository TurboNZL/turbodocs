import { isNumeric, key, numberOf, unkey, type Cell, type CellFmt, type CellValue, type Range, type Sheet } from './model.ts';

/** Pure edits of a sheet: each returns a new sheet and leaves the old one alone (that is what undo keeps). */
const copy = (s: Sheet): Sheet => ({ ...s, cells: { ...s.cells }, colW: { ...s.colW }, rowH: { ...s.rowH }, merges: s.merges.map((m) => ({ ...m })) });
const each = (g: Range, f: (r: number, c: number) => void) => { for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) f(r, c); };
const drop = (s: Sheet, k: string) => { const c = s.cells[k]; if (c && c.v === null && !c.s && c.f === undefined) delete s.cells[k]; };

export function setValue(s: Sheet, r: number, c: number, v: CellValue, extra?: { f?: string; nf?: string }): Sheet {
  const o = copy(s), k = key(r, c), prev = o.cells[k];
  const cell: Cell = { v, ...(prev?.s ? { s: prev.s } : {}) };
  if (extra?.f !== undefined) cell.f = extra.f;
  if (extra?.nf && !cell.s?.nf) cell.s = { ...cell.s, nf: extra.nf };
  if (v === null && cell.f === undefined && !cell.s) delete o.cells[k]; else o.cells[k] = cell;
  return o;
}
export function setMany(s: Sheet, at: { r: number; c: number }, rows: Cell[][]): Sheet {
  const o = copy(s);
  rows.forEach((row, i) => row.forEach((cell, j) => { const k = key(at.r + i, at.c + j); if (cell.v === null && !cell.s && cell.f === undefined) delete o.cells[k]; else o.cells[k] = { ...cell }; }));
  return o;
}
export function clearRange(s: Sheet, g: Range, withFormat = false): Sheet {
  const o = copy(s);
  each(g, (r, c) => { const k = key(r, c), cell = o.cells[k]; if (!cell) return; if (withFormat) delete o.cells[k]; else { o.cells[k] = { v: null, ...(cell.s ? { s: cell.s } : {}) }; drop(o, k); } });
  return o;
}
export function formatRange(s: Sheet, g: Range, patch: Partial<CellFmt>): Sheet {
  const o = copy(s);
  each(g, (r, c) => {
    const k = key(r, c), cell = o.cells[k] ?? { v: null };
    const merged: CellFmt = { ...cell.s, ...patch };
    for (const p of Object.keys(merged) as (keyof CellFmt)[]) if (merged[p] === undefined || merged[p] === false || merged[p] === null) delete merged[p];
    const next: Cell = { ...cell, ...(Object.keys(merged).length ? { s: merged } : {}) };
    if (!Object.keys(merged).length) delete next.s;
    if (next.v === null && !next.s && next.f === undefined) delete o.cells[k]; else o.cells[k] = next;
  });
  return o;
}
/** is every cell of the range already formatted with this flag? (drives the toolbar's pressed state and toggling) */
export const allHave = (s: Sheet, g: Range, flag: 'b' | 'i' | 'u'): boolean => { let all = true; each(g, (r, c) => { if (!s.cells[key(r, c)]?.s?.[flag]) all = false; }); return all; };

/** Insert `n` rows before row `at` (cells, row heights and merges below move down). */
export function insertRows(s: Sheet, at: number, n = 1): Sheet {
  const o = copy(s); o.cells = {}; o.rowH = {};
  for (const [k, v] of Object.entries(s.cells)) { const [r, c] = unkey(k); o.cells[key(r >= at ? r + n : r, c)] = v; }
  for (const [r, h] of Object.entries(s.rowH)) o.rowH[Number(r) >= at ? Number(r) + n : Number(r)] = h;
  o.merges = s.merges.map((m) => (m.r1 >= at ? { ...m, r1: m.r1 + n, r2: m.r2 + n } : m.r2 >= at ? { ...m, r2: m.r2 + n } : { ...m }));
  return o;
}
export function deleteRows(s: Sheet, from: number, to: number): Sheet {
  const n = to - from + 1, o = copy(s); o.cells = {}; o.rowH = {};
  for (const [k, v] of Object.entries(s.cells)) { const [r, c] = unkey(k); if (r < from) o.cells[k] = v; else if (r > to) o.cells[key(r - n, c)] = v; }
  for (const [r, h] of Object.entries(s.rowH)) { const i = Number(r); if (i < from) o.rowH[i] = h; else if (i > to) o.rowH[i - n] = h; }
  o.merges = s.merges.flatMap((m) => {
    if (m.r2 < from) return [{ ...m }];
    if (m.r1 > to) return [{ ...m, r1: m.r1 - n, r2: m.r2 - n }];
    const r1 = m.r1 < from ? m.r1 : from, r2 = m.r2 > to ? m.r2 - n : from - 1;
    return r2 >= r1 && (r2 > r1 || m.c2 > m.c1) ? [{ ...m, r1, r2 }] : [];
  });
  return o;
}
export function insertCols(s: Sheet, at: number, n = 1): Sheet {
  const o = copy(s); o.cells = {}; o.colW = {};
  for (const [k, v] of Object.entries(s.cells)) { const [r, c] = unkey(k); o.cells[key(r, c >= at ? c + n : c)] = v; }
  for (const [c, w] of Object.entries(s.colW)) o.colW[Number(c) >= at ? Number(c) + n : Number(c)] = w;
  o.merges = s.merges.map((m) => (m.c1 >= at ? { ...m, c1: m.c1 + n, c2: m.c2 + n } : m.c2 >= at ? { ...m, c2: m.c2 + n } : { ...m }));
  return o;
}
export function deleteCols(s: Sheet, from: number, to: number): Sheet {
  const n = to - from + 1, o = copy(s); o.cells = {}; o.colW = {};
  for (const [k, v] of Object.entries(s.cells)) { const [r, c] = unkey(k); if (c < from) o.cells[k] = v; else if (c > to) o.cells[key(r, c - n)] = v; }
  for (const [c, w] of Object.entries(s.colW)) { const i = Number(c); if (i < from) o.colW[i] = w; else if (i > to) o.colW[i - n] = w; }
  o.merges = s.merges.flatMap((m) => {
    if (m.c2 < from) return [{ ...m }];
    if (m.c1 > to) return [{ ...m, c1: m.c1 - n, c2: m.c2 - n }];
    const c1 = m.c1 < from ? m.c1 : from, c2 = m.c2 > to ? m.c2 - n : from - 1;
    return c2 >= c1 && (c2 > c1 || m.r2 > m.r1) ? [{ ...m, c1, c2 }] : [];
  });
  return o;
}

/** Sort the rows of a range by one column (empty cells last, numbers before text); the whole rows of the range move together. */
export function sortRange(s: Sheet, g: Range, byCol: number, ascending: boolean, hasHeader: boolean): Sheet {
  const first = hasHeader ? g.r1 + 1 : g.r1;
  if (first >= g.r2) return s;
  const rows: Cell[][] = [];
  for (let r = first; r <= g.r2; r++) { const row: Cell[] = []; for (let c = g.c1; c <= g.c2; c++) row.push(s.cells[key(r, c)] ?? { v: null }); rows.push(row); }
  const at = byCol - g.c1;
  const rank = (cell: Cell): [number, number | string] => { const v = cell.v; if (v === null || v === '') return [3, 0]; const n = numberOf(v); if (n !== null && typeof v !== 'boolean') return [0, n]; if (typeof v === 'boolean') return [2, v ? 1 : 0]; return [1, String(v).toLowerCase()]; };
  const sorted = rows.map((row, i) => ({ row, i })).sort((a, b) => {
    const x = rank(a.row[at]), y = rank(b.row[at]);
    if (x[0] === 3 || y[0] === 3) return x[0] === y[0] ? a.i - b.i : x[0] === 3 ? 1 : -1; // empty always last
    let d = x[0] - y[0] || (typeof x[1] === 'number' && typeof y[1] === 'number' ? x[1] - y[1] : String(x[1]).localeCompare(String(y[1]), undefined, { numeric: true }));
    if (!ascending) d = -d;
    return d || a.i - b.i;
  });
  return clearThenSet(s, g, first, sorted.map((x) => x.row));
}
function clearThenSet(s: Sheet, g: Range, first: number, rows: Cell[][]): Sheet {
  const o = copy(s);
  for (let r = first; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) delete o.cells[key(r, c)];
  return setMany(o, { r: first, c: g.c1 }, rows);
}
/** Ctrl+D / Ctrl+R: copy the first row (or column) of the range into the rest. */
export function fill(s: Sheet, g: Range, dir: 'down' | 'right'): Sheet {
  const o = copy(s);
  each(g, (r, c) => {
    if (dir === 'down' ? r === g.r1 : c === g.c1) return;
    const src = o.cells[key(dir === 'down' ? g.r1 : r, dir === 'down' ? c : g.c1)];
    if (src) o.cells[key(r, c)] = { ...src }; else delete o.cells[key(r, c)];
  });
  return o;
}
export function mergeRange(s: Sheet, g: Range): Sheet {
  if (g.r1 === g.r2 && g.c1 === g.c2) return s;
  const o = copy(s);
  o.merges = o.merges.filter((m) => m.r2 < g.r1 || m.r1 > g.r2 || m.c2 < g.c1 || m.c1 > g.c2);
  o.merges.push({ ...g });
  each(g, (r, c) => { if (r !== g.r1 || c !== g.c1) { const k = key(r, c); const cell = o.cells[k]; if (cell) { o.cells[k] = { v: null, ...(cell.s ? { s: cell.s } : {}) }; drop(o, k); } } });
  return o;
}
export function unmergeRange(s: Sheet, g: Range): Sheet {
  const o = copy(s);
  o.merges = o.merges.filter((m) => m.r2 < g.r1 || m.r1 > g.r2 || m.c2 < g.c1 || m.c1 > g.c2);
  return o;
}
export const mergeAt = (s: Sheet, r: number, c: number): Range | undefined => s.merges.find((m) => r >= m.r1 && r <= m.r2 && c >= m.c1 && c <= m.c2);

/** tab-separated text of a range, for the clipboard and for pasting into other programs */
export function toTsv(s: Sheet, g: Range, show: (c: Cell | undefined) => string): string {
  const lines: string[] = [];
  for (let r = g.r1; r <= g.r2; r++) { const row: string[] = []; for (let c = g.c1; c <= g.c2; c++) { const t = show(s.cells[key(r, c)]); row.push(/[\t\n"]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t); } lines.push(row.join('\t')); }
  return lines.join('\n');
}
export function fromTsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], f = '', q = false;
  const t = text.replace(/\r\n?/g, '\n');
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"' && f === '') q = true;
    else if (ch === '\t') { row.push(f); f = ''; }
    else if (ch === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else f += ch;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows;
}
export const stats = (s: Sheet, g: Range): { count: number; sum: number; avg: number; min: number; max: number } | null => {
  let count = 0, sum = 0, min = Infinity, max = -Infinity;
  each(g, (r, c) => { const v = s.cells[key(r, c)]?.v; if (v === null || v === undefined || typeof v === 'boolean' || !isNumeric(v)) return; const n = numberOf(v)!; count++; sum += n; min = Math.min(min, n); max = Math.max(max, n); });
  return count ? { count, sum, avg: sum / count, min, max } : null;
};
