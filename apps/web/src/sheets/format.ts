import type { Cell } from './model.ts';

const BUILTIN: Record<number, string> = {
  1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 9: '0%', 10: '0.00%', 11: '0.00E+00', 14: 'yyyy-mm-dd', 15: 'd-mmm-yy', 16: 'd-mmm', 17: 'mmm-yy', 18: 'h:mm AM/PM', 19: 'h:mm:ss AM/PM', 20: 'h:mm', 21: 'h:mm:ss',
  22: 'yyyy-mm-dd h:mm', 37: '#,##0;-#,##0', 38: '#,##0;-#,##0', 39: '#,##0.00;-#,##0.00', 40: '#,##0.00;-#,##0.00', 45: 'mm:ss', 46: '[h]:mm:ss', 47: 'mm:ss.0', 48: '##0.0E+0', 49: '@',
};
/** the format code of a built-in number format id (null = General) */
export const builtinFormat = (id: number): string | null => BUILTIN[id] ?? null;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const strip = (code: string) => code.replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"/g, '').replace(/\\./g, '');
const isDateCode = (code: string) => /[ymdhs]/i.test(strip(code)) && !/^(general|@)$/i.test(code);

/** the date an Excel serial number stands for (1900 date system) */
export function serialToDate(serial: number): Date { return new Date(Math.round((Date.UTC(1899, 11, 30) + serial * 86400000))); }
export const dateToSerial = (d: Date): number => (d.getTime() - Date.UTC(1899, 11, 30)) / 86400000;

function formatDate(serial: number, code: string): string {
  const d = serialToDate(serial);
  const pm12 = /AM\/PM|A\/P/i.test(code);
  const parts = code.replace(/\[[^\]]*\]/g, '').match(/"[^"]*"|\\.|yyyy|yy|mmmmm|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|AM\/PM|A\/P|\.0+|[^]/gi) ?? [];
  let out = '';
  parts.forEach((p, i) => {
    const lower = p.toLowerCase();
    // m right after h, or right before s, is minutes
    const prev = parts.slice(0, i).reverse().find((x) => /^(h|hh|s|ss|d|dd|yy|yyyy|m|mm)$/i.test(x));
    const next = parts.slice(i + 1).find((x) => /^(h|hh|s|ss|d|dd|yy|yyyy|m|mm)$/i.test(x));
    const minute = (lower === 'm' || lower === 'mm') && (/^hh?$/i.test(prev ?? '') || /^ss?$/i.test(next ?? ''));
    if (p.startsWith('"')) out += p.slice(1, -1);
    else if (p.startsWith('\\')) out += p.slice(1);
    else if (lower === 'yyyy') out += d.getUTCFullYear();
    else if (lower === 'yy') out += String(d.getUTCFullYear()).slice(-2);
    else if (minute) out += lower === 'mm' ? String(d.getUTCMinutes()).padStart(2, '0') : d.getUTCMinutes();
    else if (lower === 'mmmmm') out += MONTHS[d.getUTCMonth()][0];
    else if (lower === 'mmmm') out += MONTHS[d.getUTCMonth()];
    else if (lower === 'mmm') out += MONTHS[d.getUTCMonth()].slice(0, 3);
    else if (lower === 'mm') out += String(d.getUTCMonth() + 1).padStart(2, '0');
    else if (lower === 'm') out += d.getUTCMonth() + 1;
    else if (lower === 'dddd') out += DAYS[d.getUTCDay()];
    else if (lower === 'ddd') out += DAYS[d.getUTCDay()].slice(0, 3);
    else if (lower === 'dd') out += String(d.getUTCDate()).padStart(2, '0');
    else if (lower === 'd') out += d.getUTCDate();
    else if (lower === 'hh' || lower === 'h') { const h = pm12 ? d.getUTCHours() % 12 || 12 : d.getUTCHours(); out += lower === 'hh' ? String(h).padStart(2, '0') : h; }
    else if (lower === 'ss') out += String(d.getUTCSeconds()).padStart(2, '0');
    else if (lower === 'am/pm' || lower === 'a/p') out += d.getUTCHours() >= 12 ? (lower === 'a/p' ? 'P' : 'PM') : (lower === 'a/p' ? 'A' : 'AM');
    else out += p;
  });
  return out;
}

function formatNumber(n: number, code: string): string {
  const sections = code.split(';');
  let sec = sections[0];
  let v = n;
  if (n < 0 && sections.length > 1) { sec = sections[1]; v = -n; }
  const lit = (s: string) => s.replace(/\[[^\]]*\]/g, '').replace(/_./g, ' ').replace(/\*./g, '').replace(/\\(.)/g, '$1').replace(/"([^"]*)"/g, '$1');
  const m = /^([^0#?.,]*(?:"[^"]*"[^0#?.,]*)*)([0#?,.]+(?:E[+-]0+)?)(.*)$/is.exec(sec.replace(/\[[^\]]*\]/g, ''));
  if (!m) return String(n);
  const [, pre, pat, post] = m;
  const percent = /%/.test(sec);
  if (percent) v *= 100;
  const sci = /E[+-]0+/i.exec(pat);
  const body = sci ? pat.slice(0, sci.index) : pat;
  const decimals = (body.split('.')[1] ?? '').replace(/[^0#?]/g, '').length;
  const thousands = /,/.test(body.split('.')[0]);
  let text: string;
  if (sci) {
    const exp = Math.floor(Math.log10(Math.abs(v) || 1));
    const mant = v / 10 ** exp;
    text = `${mant.toFixed(decimals)}E${exp < 0 ? '-' : '+'}${String(Math.abs(exp)).padStart(sci[0].length - 2, '0')}`;
  } else {
    text = Math.abs(v).toFixed(decimals);
    const minInt = (body.split('.')[0].match(/0/g) ?? []).length;
    let [int, frac] = text.split('.');
    if (int.length < minInt) int = int.padStart(minInt, '0');
    if (minInt === 0 && int === '0' && decimals > 0) int = '';
    if (thousands) int = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    // optional trailing decimals (#) are trimmed
    if (frac) { const optional = (body.split('.')[1] ?? '').replace(/[^0#?]/g, ''); let keep = frac.length; while (keep > 0 && optional[keep - 1] === '#' && frac[keep - 1] === '0') keep--; frac = frac.slice(0, keep); }
    text = frac ? `${int}.${frac}` : int;
    if (v < 0 && sections.length < 2 && Number(text.replace(/,/g, '')) !== 0) text = `-${text}`;
  }
  return `${lit(pre)}${text}${lit(post)}`;
}

/** The text shown in a cell: the value in the cell's number format. */
export function formatCell(cell: Cell | undefined): string {
  if (!cell || cell.v === null || cell.v === '') return '';
  const v = cell.v;
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'string') return v;
  const code = cell.s?.nf;
  if (!code || /^general$/i.test(code)) return Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(12)));
  if (code === '@') return String(v);
  try { return isDateCode(code) ? formatDate(v, code) : formatNumber(v, code); } catch { return String(v); }
}
export { isDateCode };

/** "Number format" choices of the toolbar. `code: null` = General. */
export const NUMBER_FORMATS: { label: string; code: string | null }[] = [
  { label: 'Automatic', code: null }, { label: 'Number  1,000.00', code: '#,##0.00' }, { label: 'Integer  1,000', code: '#,##0' }, { label: 'Percent  10%', code: '0%' },
  { label: 'Currency  $1,000.00', code: '"$"#,##0.00' }, { label: 'Date  2026-10-17', code: 'yyyy-mm-dd' }, { label: 'Date  17 Oct 2026', code: 'd mmm yyyy' }, { label: 'Time  14:30', code: 'h:mm' }, { label: 'Scientific  1.00E+03', code: '0.00E+00' }, { label: 'Text', code: '@' },
];

/** One more or one fewer decimal place in a number format ("#,##0.00" -> "#,##0.0"); General becomes "0" first; dates and text are left alone. */
export function changeDecimals(nf: string | null | undefined, delta: number): string | null {
  const code = !nf || /^general$/i.test(nf) ? '0' : nf;
  if (isDateCode(code) || code === '@') return nf ?? null;
  return code.split(';').map((sec) => {
    let done = false;
    return sec.split('"').map((seg, i) => {
      if (i % 2 === 1 || done) return seg;
      return seg.replace(/([#0][#0,]*)(?:\.(0*))?/, (_m, int: string, frac?: string) => { done = true; const n = Math.max(0, (frac?.length ?? 0) + delta); return `${int}${n ? `.${'0'.repeat(n)}` : ''}`; });
    }).join('"');
  }).join(';');
}
