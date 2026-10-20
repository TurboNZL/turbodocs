import { isEmptyCell, isNumeric, key, numberOf, unkey, type Borders, type Cell, type CellFmt, type CellValue, type Edge, type Range, type Sheet } from './model.ts';
import { isDateCode } from './format.ts';
import { shiftCharts } from './charts.ts';

/** Pure edits of a sheet: each returns a new sheet and leaves the old one alone (that is what undo keeps). */
const copy = (s: Sheet): Sheet => ({ ...s, cells: { ...s.cells }, colW: { ...s.colW }, rowH: { ...s.rowH }, merges: s.merges.map((m) => ({ ...m })) });
const each = (g: Range, f: (r: number, c: number) => void) => { for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) f(r, c); };
const drop = (s: Sheet, k: string) => { const c = s.cells[k]; if (c && isEmptyCell(c)) delete s.cells[k]; };

export function setValue(s: Sheet, r: number, c: number, v: CellValue, extra?: { f?: string; nf?: string }): Sheet {
  const o = copy(s), k = key(r, c), prev = o.cells[k];
  const cell: Cell = { v, ...(prev?.s ? { s: prev.s } : {}), ...(prev?.link ? { link: prev.link } : {}) };
  if (extra?.f !== undefined) cell.f = extra.f;
  if (extra?.nf && !cell.s?.nf) cell.s = { ...cell.s, nf: extra.nf };
  if (isEmptyCell(cell)) delete o.cells[k]; else o.cells[k] = cell;
  return o;
}
export function setMany(s: Sheet, at: { r: number; c: number }, rows: Cell[][]): Sheet {
  const o = copy(s);
  rows.forEach((row, i) => row.forEach((cell, j) => { const k = key(at.r + i, at.c + j); if (isEmptyCell(cell)) delete o.cells[k]; else o.cells[k] = { ...cell }; }));
  return o;
}
export function clearRange(s: Sheet, g: Range, withFormat = false): Sheet {
  const o = copy(s);
  each(g, (r, c) => { const k = key(r, c), cell = o.cells[k]; if (!cell) return; if (withFormat) delete o.cells[k]; else { o.cells[k] = { v: null, ...(cell.s ? { s: cell.s } : {}), ...(cell.link ? { link: cell.link } : {}) }; drop(o, k); } });
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
    if (isEmptyCell(next)) delete o.cells[k]; else o.cells[k] = next;
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
  o.charts = shiftCharts(s.charts, 'r', { insert: { at, n } });
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
  o.charts = shiftCharts(s.charts, 'r', { remove: { from, to } });
  return o;
}
export function insertCols(s: Sheet, at: number, n = 1): Sheet {
  const o = copy(s); o.cells = {}; o.colW = {};
  for (const [k, v] of Object.entries(s.cells)) { const [r, c] = unkey(k); o.cells[key(r, c >= at ? c + n : c)] = v; }
  for (const [c, w] of Object.entries(s.colW)) o.colW[Number(c) >= at ? Number(c) + n : Number(c)] = w;
  o.merges = s.merges.map((m) => (m.c1 >= at ? { ...m, c1: m.c1 + n, c2: m.c2 + n } : m.c2 >= at ? { ...m, c2: m.c2 + n } : { ...m }));
  o.charts = shiftCharts(s.charts, 'c', { insert: { at, n } });
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
  o.charts = shiftCharts(s.charts, 'c', { remove: { from, to } });
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

export type BorderMode = 'all' | 'outer' | 'inner' | 'top' | 'bottom' | 'left' | 'right' | 'none';
/** Borders on a range: each cell keeps its own edges (as in the file); `none` clears every edge of the range. */
export function setBorders(s: Sheet, g: Range, mode: BorderMode, edge: Edge): Sheet {
  const o = copy(s);
  each(g, (r, c) => {
    const k = key(r, c), cell = o.cells[k] ?? { v: null };
    const sides: (keyof Borders)[] = [];
    const top = r === g.r1, bottom = r === g.r2, left = c === g.c1, right = c === g.c2;
    if (mode === 'all') sides.push('t', 'b', 'l', 'r');
    else if (mode === 'outer') { if (top) sides.push('t'); if (bottom) sides.push('b'); if (left) sides.push('l'); if (right) sides.push('r'); }
    else if (mode === 'inner') { if (!top) sides.push('t'); if (!bottom) sides.push('b'); if (!left) sides.push('l'); if (!right) sides.push('r'); }
    else if (mode === 'top' && top) sides.push('t'); else if (mode === 'bottom' && bottom) sides.push('b'); else if (mode === 'left' && left) sides.push('l'); else if (mode === 'right' && right) sides.push('r');
    let bd: Borders | undefined = cell.s?.bd;
    if (mode === 'none') bd = undefined;
    else if (sides.length) { bd = { ...bd }; for (const side of sides) bd[side] = { ...edge }; }
    if (bd === cell.s?.bd) return;
    const fmt: CellFmt = { ...cell.s }; if (bd) fmt.bd = bd; else delete fmt.bd;
    const next: Cell = { ...cell, ...(Object.keys(fmt).length ? { s: fmt } : {}) }; if (!Object.keys(fmt).length) delete next.s;
    if (isEmptyCell(next)) delete o.cells[k]; else o.cells[k] = next;
  });
  return o;
}

/**
 * The fill handle: extend `src` over `to` (a range that contains it and grows in one direction). Numbers that step evenly go on stepping, a date goes on a day at a time,
 * text ending in a number counts up ("Item 1", "Item 2"), anything else repeats. Formulas are copied as they are (nothing is calculated here).
 */
export function autofill(s: Sheet, src: Range, to: Range): Sheet {
  const down = to.r2 > src.r2, up = to.r1 < src.r1, right = to.c2 > src.c2, left = to.c1 < src.c1;
  const vertical = down || up;
  if (!vertical && !right && !left) return s;
  const o = copy(s);
  const lines = vertical ? src.c2 - src.c1 + 1 : src.r2 - src.r1 + 1, len = vertical ? src.r2 - src.r1 + 1 : src.c2 - src.c1 + 1;
  const forward = down || right;
  const total = vertical ? (down ? to.r2 - src.r2 : src.r1 - to.r1) : (right ? to.c2 - src.c2 : src.c1 - to.c1);
  for (let l = 0; l < lines; l++) {
    const at = (i: number) => (vertical ? key(src.r1 + i, src.c1 + l) : key(src.r1 + l, src.c1 + i)); // i is an index into the source line
    const cells = Array.from({ length: len }, (_, i) => s.cells[at(i)]);
    const nums = cells.map((c) => (c && c.f === undefined && typeof c.v === 'number' ? c.v : null));
    const allNum = nums.every((n) => n !== null);
    const step = allNum ? (len > 1 ? (nums[len - 1]! - nums[0]!) / (len - 1) : cells[0]?.s?.nf && isDateCode(cells[0].s.nf) ? 1 : 0) : 0;
    const even = allNum && nums.every((n, i) => i === 0 || Math.abs(n! - nums[i - 1]! - step) < 1e-9);
    const tails = cells.map((c) => (c && c.f === undefined && typeof c.v === 'string' ? /^(.*?)(\d+)$/.exec(c.v) : null));
    const textSeries = tails.every((m) => m) && tails.every((m) => m![1] === tails[0]![1]) && (len === 1 || tails.every((m, i) => i === 0 || Number(m![2]) - Number(tails[i - 1]![2]) === Number(tails[1]![2]) - Number(tails[0]![2])));
    const tstep = textSeries ? (len > 1 ? Number(tails[1]![2]) - Number(tails[0]![2]) : 1) : 0;
    for (let k = 1; k <= total; k++) {
      const dst = vertical ? key(down ? src.r2 + k : src.r1 - k, src.c1 + l) : key(src.r1 + l, right ? src.c2 + k : src.c1 - k);
      const i = forward ? (k - 1) % len : (len - 1 - ((k - 1) % len)); // the source cell this one copies the look of
      const base = cells[i];
      if (!base) { delete o.cells[dst]; continue; }
      let cell: Cell = { ...base };
      if (base.f !== undefined) { const [br, bc] = unkey(at(i)), [tr, tc] = unkey(dst); cell = { ...base, f: shiftFormula(base.f, tr - br, tc - bc) }; }
      if (even && step !== 0) cell = { ...base, v: forward ? nums[len - 1]! + step * k : nums[0]! - step * k };
      else if (textSeries && tstep !== 0) { const m = tails[forward ? len - 1 : 0]!; const n = Number(m[2]) + (forward ? tstep * k : -tstep * k); const w = m[2].length; cell = { ...base, v: `${m[1]}${n < 0 ? Math.abs(n) : String(n).padStart(m[2].startsWith('0') ? w : 0, '0')}` }; }
      o.cells[dst] = cell;
    }
  }
  return o;
}

/** A link (or none) on every cell of a range; an empty cell gets the address as its text. */
export function setLink(s: Sheet, g: Range, url: string | undefined): Sheet {
  const o = copy(s);
  each(g, (r, c) => {
    const k = key(r, c), cell = o.cells[k] ?? { v: null };
    const next: Cell = { ...cell }; if (url) { next.link = url; if (next.v === null && next.f === undefined) next.v = url; } else delete next.link;
    if (isEmptyCell(next)) delete o.cells[k]; else o.cells[k] = next;
  });
  return o;
}

/** A formula as it reads one cell (or `dr` rows and `dc` columns) further on: relative references move, $-fixed ones stay (what filling and pasting do). */
export function shiftFormula(f: string, dr: number, dc: number): string {
  const colNum = (n: string) => { let x = 0; for (const ch of n) x = x * 26 + ch.charCodeAt(0) - 64; return x; };
  const colAt = (x: number) => { let o = ''; for (let n = x; n > 0; n = Math.floor((n - 1) / 26)) o = String.fromCharCode(65 + ((n - 1) % 26)) + o; return o; };
  return f.split(/("(?:[^"]|"")*")/).map((part, i) => (i % 2 ? part : part.replace(/(^|[^A-Za-z0-9_.$])(\$?)([A-Z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_(])/g, (m, pre: string, ca: string, col: string, ra: string, row: string) => {
    const c = ca ? colNum(col) : colNum(col) + dc, r = ra ? Number(row) : Number(row) + dr;
    return c < 1 || r < 1 || c > 16384 || r > 1048576 ? `${pre}#REF!` : `${pre}${ca}${colAt(c)}${ra}${r}`;
  }))).join('');
}
