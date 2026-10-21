import { formatCell } from './format.ts';
import { key, numberOf, type CellValue, type CfRule, type Range, type Sheet, type Validation } from './model.ts';

/** Conditional formatting, data validation and filters: the rules that decide how a cell looks or what it may hold. All pure. */
const inRange = (g: Range, r: number, c: number) => r >= g.r1 && r <= g.r2 && c >= g.c1 && c <= g.c2;
const hex = (c: string): [number, number, number] => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a: string, b: string, t: number) => { const x = hex(a), y = hex(b); return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`; };

export interface CfLook { fill?: string; color?: string; bold?: boolean }

/** A function giving the look the rules add to a cell (the first matching rule wins; colour scales are worked out once per range). */
export function cfEvaluator(s: Sheet): ((r: number, c: number) => CfLook | undefined) | null {
  const rules = s.cf ?? [];
  if (!rules.length) return null;
  const spans = new Map<string, [number, number]>();
  for (const rule of rules) if (rule.kind === 'scale') {
    let lo = Infinity, hi = -Infinity;
    for (let r = rule.range.r1; r <= rule.range.r2; r++) for (let c = rule.range.c1; c <= rule.range.c2; c++) { const v = numberOf(s.cells[key(r, c)]?.v ?? null); if (v !== null) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }
    spans.set(rule.id, [lo, hi]);
  }
  return (r, c) => {
    const cell = s.cells[key(r, c)];
    const v: CellValue = cell?.v ?? null;
    for (const rule of rules) {
      if (!inRange(rule.range, r, c)) continue;
      const look = matches(rule, v, cell ? formatCell(cell) : '', spans.get(rule.id));
      if (look) return look;
    }
    return undefined;
  };
}
function matches(rule: CfRule, v: CellValue, shown: string, span?: [number, number]): CfLook | undefined {
  const look: CfLook = { ...(rule.fill ? { fill: rule.fill } : {}), ...(rule.color ? { color: rule.color } : {}), ...(rule.bold ? { bold: true } : {}) };
  const empty = v === null || v === '';
  const n = numberOf(v), a = rule.v1 === undefined || rule.v1 === '' ? null : numberOf(rule.v1), b = rule.v2 === undefined || rule.v2 === '' ? null : numberOf(rule.v2);
  switch (rule.kind) {
    case 'blank': return empty ? look : undefined;
    case 'notblank': return empty ? undefined : look;
    case 'text': return !empty && rule.v1 ? (shown.toLowerCase().includes(rule.v1.toLowerCase()) ? look : undefined) : undefined;
    case 'scale': {
      if (n === null || !span || !(span[1] >= span[0]) || !rule.lo || !rule.hi) return undefined;
      return { fill: mix(rule.lo, rule.hi, span[1] === span[0] ? 0 : (n - span[0]) / (span[1] - span[0])) };
    }
    case 'eq': case 'ne': {
      const same = n !== null && a !== null ? n === a : String(v ?? '').toLowerCase() === (rule.v1 ?? '').toLowerCase();
      return (rule.kind === 'eq') === same && !(empty && rule.kind === 'eq') ? look : undefined;
    }
    case 'between': return n !== null && a !== null && b !== null && n >= Math.min(a, b) && n <= Math.max(a, b) ? look : undefined;
    default: {
      if (n === null || a === null) return undefined;
      return (rule.kind === 'gt' ? n > a : rule.kind === 'ge' ? n >= a : rule.kind === 'lt' ? n < a : n <= a) ? look : undefined;
    }
  }
}
export const CF_KINDS: [CfRule['kind'], string][] = [['gt', 'Greater than'], ['ge', 'Greater than or equal to'], ['lt', 'Less than'], ['le', 'Less than or equal to'], ['eq', 'Equal to'], ['ne', 'Not equal to'], ['between', 'Between'], ['text', 'Text contains'], ['blank', 'Is empty'], ['notblank', 'Is not empty'], ['scale', 'Colour scale']];

// ---------------------------------------------------------------- validation
/** The choices of a list validation: typed in, or read from the cells of its source range. */
export function listItems(s: Sheet, v: Validation): string[] {
  if (v.items) return v.items;
  const m = v.source ? /^\$?([A-Z]{1,3})\$?(\d+)(?::\$?([A-Z]{1,3})\$?(\d+))?$/.exec(v.source.replace(/^'?[^!']*'?!/, '').trim()) : null;
  if (!m) return [];
  const col = (n: string) => { let x = 0; for (const ch of n) x = x * 26 + ch.charCodeAt(0) - 64; return x - 1; };
  const c1 = col(m[1]), r1 = Number(m[2]) - 1, c2 = m[3] ? col(m[3]) : c1, r2 = m[4] ? Number(m[4]) - 1 : r1, out: string[] = [];
  for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) { const t = formatCell(s.cells[key(r, c)]); if (t !== '') out.push(t); }
  return out;
}
export const validationAt = (s: Sheet, r: number, c: number): Validation | undefined => (s.dv ?? []).find((v) => inRange(v.range, r, c));
/** null when `text` may go into the cell, otherwise what to tell the user */
export function validate(s: Sheet, r: number, c: number, text: string): string | null {
  const v = validationAt(s, r, c);
  if (!v) return null;
  if (text === '') return v.blank ? null : 'This cell may not be empty.';
  if (v.kind === 'list') { const items = listItems(s, v); return items.some((i) => i.toLowerCase() === text.trim().toLowerCase()) ? null : (v.message || `Pick one of: ${items.slice(0, 8).join(', ')}${items.length > 8 ? ', …' : ''}.`); }
  const n = numberOf(text.trim());
  const bad = v.message || (v.kind === 'whole' ? 'Type a whole number' : 'Type a number') + (v.min !== undefined && v.max !== undefined ? ` from ${v.min} to ${v.max}.` : v.min !== undefined ? ` of at least ${v.min}.` : v.max !== undefined ? ` of at most ${v.max}.` : '.');
  if (n === null || (v.kind === 'whole' && !Number.isInteger(n))) return bad;
  if ((v.min !== undefined && n < v.min) || (v.max !== undefined && n > v.max)) return bad;
  return null;
}

// ---------------------------------------------------------------- filter
/** The rows a filter hides (never the heading row). */
export function hiddenRows(s: Sheet): Set<number> {
  const f = s.filter, out = new Set<number>();
  if (!f) return out;
  const cols = Object.entries(f.show);
  if (!cols.length) return out;
  for (let r = f.range.r1 + 1; r <= f.range.r2; r++) for (const [c, allowed] of cols) if (!allowed.includes(formatCell(s.cells[key(r, Number(c))]))) { out.add(r); break; }
  return out;
}
/** the different texts a filtered column holds (below the heading), in order of first appearance, with how often */
export function columnValues(s: Sheet, f: { range: Range }, c: number): { text: string; n: number }[] {
  const seen = new Map<string, number>();
  for (let r = f.range.r1 + 1; r <= f.range.r2; r++) { const t = formatCell(s.cells[key(r, c)]); seen.set(t, (seen.get(t) ?? 0) + 1); }
  return [...seen].map(([text, n]) => ({ text, n }));
}
