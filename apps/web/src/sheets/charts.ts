import { formatCell } from './format.ts';
import { key, numberOf, type Chart, type Sheet } from './model.ts';

export interface ChartData { cats: string[]; series: { name: string; values: (number | null)[] }[] }
let seq = 0;
export const chartId = () => `ch${Date.now().toString(36)}${(seq++).toString(36)}`;
export const PALETTE = ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1', '#ff9da7'];

/** What a chart shows right now: read from the cells of its range each time, so it follows every edit. */
export function chartData(s: Sheet, c: Chart): ChartData {
  const { r1, c1, r2, c2 } = c.range;
  const first = c.header ? r1 + 1 : r1;
  const labels = c.labels && c2 > c1;
  const sc = labels ? c1 + 1 : c1;
  const cats: string[] = [];
  for (let r = first; r <= r2; r++) cats.push(labels ? formatCell(s.cells[key(r, c1)]) : String(r - first + 1));
  const series: ChartData['series'] = [];
  for (let col = sc; col <= c2; col++) {
    const values: (number | null)[] = [];
    for (let r = first; r <= r2; r++) { const v = s.cells[key(r, col)]?.v; values.push(v === undefined || v === null || typeof v === 'boolean' ? null : numberOf(v)); }
    series.push({ name: c.header ? formatCell(s.cells[key(r1, col)]) || `Series ${series.length + 1}` : `Series ${series.length + 1}`, values });
  }
  return { cats, series };
}

/** a tidy axis: round numbers from `min` to at least `max` */
export function niceAxis(min: number, max: number, want = 5): { lo: number; hi: number; step: number; ticks: number[] } {
  if (!(max > min)) { max = min + 1; }
  const raw = (max - min) / want, mag = 10 ** Math.floor(Math.log10(raw)), f = raw / mag;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  const lo = Math.floor(min / step + 1e-9) * step, hi = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = []; for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v / step) * step);
  return { lo, hi, step, ticks };
}
export const shortNumber = (n: number): string => { const a = Math.abs(n); if (a >= 1e9) return `${+(n / 1e9).toFixed(2)}B`; if (a >= 1e6) return `${+(n / 1e6).toFixed(2)}M`; if (a >= 1e4) return `${+(n / 1e3).toFixed(1)}k`; return String(+n.toFixed(4)); };

/** Charts after rows or columns were inserted (`at`, `n`) or deleted (`from`..`to`): their ranges follow the cells; one whose data is gone is dropped. */
export function shiftCharts(charts: Chart[] | undefined, axis: 'r' | 'c', change: { insert: { at: number; n: number } } | { remove: { from: number; to: number } }): Chart[] | undefined {
  if (!charts?.length) return charts;
  const lo = axis === 'r' ? 'r1' : 'c1', hi = axis === 'r' ? 'r2' : 'c2';
  const out: Chart[] = [];
  for (const ch of charts) {
    const g = { ...ch.range };
    if ('insert' in change) { const { at, n } = change.insert; if (g[lo] >= at) { g[lo] += n; g[hi] += n; } else if (g[hi] >= at) g[hi] += n; }
    else {
      const { from, to } = change.remove, n = to - from + 1;
      if (g[hi] < from) { /* above or left: unchanged */ }
      else if (g[lo] > to) { g[lo] -= n; g[hi] -= n; }
      else { const a = g[lo] < from ? g[lo] : from, b = g[hi] > to ? g[hi] - n : from - 1; if (b < a) continue; g[lo] = a; g[hi] = b; }
    }
    out.push({ ...ch, range: g });
  }
  return out;
}

/** the block of filled cells around a cell (what a chart or a sort takes when only one cell is selected) */
export function currentRegion(s: Sheet, at: { r: number; c: number }): { r1: number; c1: number; r2: number; c2: number } {
  const filled = (r: number, c: number) => { const v = s.cells[key(r, c)]?.v; return v !== null && v !== undefined && v !== ''; };
  const g = { r1: at.r, c1: at.c, r2: at.r, c2: at.c };
  if (!filled(at.r, at.c)) return g;
  for (let grew = true; grew;) {
    grew = false;
    const touches = (r: number, c: number) => r >= 0 && c >= 0 && filled(r, c);
    const row = (r: number) => { for (let c = g.c1 - 1; c <= g.c2 + 1; c++) if (touches(r, c)) return true; return false; };
    const col = (c: number) => { for (let r = g.r1 - 1; r <= g.r2 + 1; r++) if (touches(r, c)) return true; return false; };
    if (g.r1 > 0 && row(g.r1 - 1)) { g.r1--; grew = true; }
    if (row(g.r2 + 1) && g.r2 < 1048575) { g.r2++; grew = true; }
    if (g.c1 > 0 && col(g.c1 - 1)) { g.c1--; grew = true; }
    if (col(g.c2 + 1) && g.c2 < 16383) { g.c2++; grew = true; }
  }
  return g;
}

/** Does the first row / first column of a block look like names (text) rather than numbers? */
export function guessHeaders(s: Sheet, g: { r1: number; c1: number; r2: number; c2: number }): { header: boolean; labels: boolean } {
  const isText = (r: number, c: number) => { const v = s.cells[key(r, c)]?.v; return v !== undefined && v !== null && v !== '' && numberOf(v) === null; };
  const rows = g.r2 - g.r1 + 1, cols = g.c2 - g.c1 + 1;
  let headerCells = 0, headerText = 0;
  for (let c = g.c1 + (cols > 1 ? 1 : 0); c <= g.c2; c++) { headerCells++; if (isText(g.r1, c)) headerText++; }
  let bodyNum = 0; for (let c = g.c1 + (cols > 1 ? 1 : 0); c <= g.c2 && rows > 1; c++) for (let r = g.r1 + 1; r <= g.r2; r++) if (numberOf(s.cells[key(r, c)]?.v ?? null) !== null) bodyNum++;
  const header = rows > 1 && headerCells > 0 && headerText === headerCells && bodyNum > 0;
  let labelText = 0, labelCells = 0;
  for (let r = g.r1 + (header ? 1 : 0); r <= g.r2; r++) { labelCells++; if (isText(r, g.c1)) labelText++; }
  return { header, labels: cols > 1 && labelCells > 0 && labelText === labelCells };
}
