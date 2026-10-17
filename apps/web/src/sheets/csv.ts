import type { Workbook, Cell } from './model.ts';
import { emptySheet, key } from './model.ts';

/** The delimiter a text most likely uses: the one that appears most (outside quotes) in the first lines. */
export function detectDelimiter(text: string): string {
  const head = text.slice(0, 4000);
  let best = ',', bestN = 0;
  for (const d of [',', ';', '\t', '|']) {
    let n = 0, quoted = false;
    for (const ch of head) { if (ch === '"') quoted = !quoted; else if (!quoted && ch === d) n++; }
    if (n > bestN) { best = d; bestN = n; }
  }
  return best;
}

/** RFC 4180: quoted fields with "" escapes, newlines inside quotes, a final line without a newline. */
export function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false, i = 0, any = false;
  const t = text.replace(/^﻿/, '');
  for (; i < t.length; i++) {
    const ch = t[i];
    if (quoted) {
      if (ch === '"') { if (t[i + 1] === '"') { field += '"'; i++; } else quoted = false; } else field += ch;
    } else if (ch === '"' && field === '') { quoted = true; any = true; }
    else if (ch === delimiter) { row.push(field); field = ''; any = true; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; any = false; }
    else { field += ch; any = true; }
  }
  if (any || field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** A CSV file as a one-sheet workbook. Every value stays the text it is in the file (so "007" and "1.50" are saved exactly as they were). */
export function importCsv(bytes: Uint8Array | string): { book: Workbook; crlf: boolean; bom: boolean } {
  const text = typeof bytes === 'string' ? bytes : new TextDecoder('utf-8').decode(bytes);
  const bom = text.charCodeAt(0) === 0xfeff;
  const delimiter = detectDelimiter(text);
  const sheet = emptySheet('Sheet1');
  parseCsv(text, delimiter).forEach((r, ri) => r.forEach((v, ci) => { if (v !== '') sheet.cells[key(ri, ci)] = { v } as Cell; }));
  return { book: { sheets: [sheet], active: 0, delimiter }, crlf: /\r\n/.test(text), bom };
}

const needsQuote = (s: string, d: string) => s.includes(d) || s.includes('"') || /[\r\n]/.test(s) || /^\s|\s$/.test(s);
export function exportCsv(book: Workbook, opts: { crlf: boolean; bom: boolean }): string {
  const sheet = book.sheets[book.active] ?? book.sheets[0];
  const d = book.delimiter ?? ',';
  let rows = 0, cols = 0;
  for (const k of Object.keys(sheet.cells)) { const [r, c] = k.split(',').map(Number); const cell = sheet.cells[k]; if (cell.v === null || cell.v === '') continue; rows = Math.max(rows, r + 1); cols = Math.max(cols, c + 1); }
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    const out: string[] = [];
    for (let c = 0; c < cols; c++) {
      const v = sheet.cells[key(r, c)]?.v;
      const s = v === null || v === undefined ? '' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v);
      out.push(needsQuote(s, d) ? `"${s.replace(/"/g, '""')}"` : s);
    }
    lines.push(out.join(d));
  }
  return `${opts.bom ? '﻿' : ''}${lines.join(opts.crlf ? '\r\n' : '\n')}${lines.length ? (opts.crlf ? '\r\n' : '\n') : ''}`;
}
