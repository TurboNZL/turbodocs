import { cellText, key, parseInput, unkey, type Sheet } from './model.ts';
import { formatCell } from './format.ts';

export interface FindOpts { matchCase: boolean; wholeCell: boolean }
export interface Hit { r: number; c: number }

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const matcher = (q: string, o: FindOpts) => new RegExp(o.wholeCell ? `^${esc(q)}$` : esc(q), o.matchCase ? 'g' : 'gi');

/** Every cell that holds the text (what is typed in it, or what it shows), in reading order. */
export function findAll(s: Sheet, q: string, o: FindOpts): Hit[] {
  if (q === '') return [];
  const re = matcher(q, o), out: Hit[] = [];
  for (const [k, cell] of Object.entries(s.cells)) {
    re.lastIndex = 0; const raw = re.test(cellText(cell));
    re.lastIndex = 0; if (raw || re.test(formatCell(cell))) { const [r, c] = unkey(k); out.push({ r, c }); }
  }
  return out.sort((a, b) => a.r - b.r || a.c - b.c);
}

/** The new text of a cell (as it would be typed) with every match replaced; null when nothing changes. */
export function replacedText(s: Sheet, at: Hit, q: string, rep: string, o: FindOpts): string | null {
  const cell = s.cells[key(at.r, at.c)];
  if (!cell || q === '') return null;
  const re = matcher(q, o);
  for (const text of [cellText(cell), formatCell(cell)]) {
    re.lastIndex = 0;
    if (re.test(text)) { re.lastIndex = 0; const out = text.replace(re, () => rep); return out === text ? null : out; }
  }
  return null;
}
/** the value a replacement typed into a cell stands for */
export const replacementValue = (text: string, csv: boolean) => (!csv && text.startsWith('=') && text.length > 1 ? { f: text.slice(1) } : { v: parseInput(text, !csv) });
