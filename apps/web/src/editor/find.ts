/** Search logic shared by the Word editor and the plain-text editor. Pure functions, tested in test/find.test.ts. */
export interface FindOptions { query: string; caseSensitive: boolean; regex: boolean }
export interface Range { from: number; to: number }
export const NO_SEARCH: FindOptions = { query: '', caseSensitive: false, regex: false };

/** The pattern for the options, or null when the query is empty or an invalid regular expression. */
export function searchRegex(o: FindOptions, global = true): RegExp | null {
  if (!o.query) return null;
  try { return new RegExp(o.regex ? o.query : o.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), `${global ? 'g' : ''}${o.caseSensitive ? '' : 'i'}`); } catch { return null; }
}

/** Every match in `text` (never an empty one, so a pattern like `a*` cannot loop). */
export function findInString(text: string, o: FindOptions): Range[] {
  const re = searchRegex(o);
  if (!re) return [];
  const out: Range[] = [];
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m[0].length === 0) { re.lastIndex++; continue; }
    out.push({ from: m.index, to: m.index + m[0].length });
    if (out.length >= 5000) break;
  }
  return out;
}

/** What a matched piece of text becomes: the replacement as typed, or with $1 / $& expanded when the query is a regular expression. */
export function replacementFor(matched: string, o: FindOptions, replacement: string): string {
  if (!o.regex) return replacement;
  const re = searchRegex(o, false);
  return re ? matched.replace(re, replacement) : replacement;
}

/** `text` with every match replaced (plain text editor). Returns the new text and how many were replaced. */
export function replaceAllInString(text: string, o: FindOptions, replacement: string): { text: string; count: number } {
  const ms = findInString(text, o);
  let out = '', last = 0;
  for (const r of ms) { out += text.slice(last, r.from) + replacementFor(text.slice(r.from, r.to), o, replacement); last = r.to; }
  return { text: out + text.slice(last), count: ms.length };
}
