import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importXlsx, exportXlsx } from '../src/sheets/xlsx.ts';
import { exportCsv, importCsv, parseCsv, detectDelimiter } from '../src/sheets/csv.ts';
import { formatCell } from '../src/sheets/format.ts';
import { addr, colIndex, colName, key, parseAddr, parseInput, parseRange, newWorkbook, type Workbook } from '../src/sheets/model.ts';

const fixture = (n: string) => new Uint8Array(readFileSync(join(import.meta.dirname, 'fixtures', n)));
const cell = (b: Workbook, sheet: number, a: string) => { const [r, c] = parseAddr(a)!; return b.sheets[sheet].cells[key(r, c)]; };

describe('addresses', () => {
  it('converts between letters and numbers', () => {
    expect([colName(0), colName(25), colName(26), colName(701), colName(702)]).toEqual(['A', 'Z', 'AA', 'ZZ', 'AAA']);
    expect(colIndex('AA')).toBe(26);
    expect(addr(0, 0)).toBe('A1'); expect(parseAddr('$C$12')).toEqual([11, 2]); expect(parseAddr('nope')).toBeNull();
    expect(parseRange('B2:A1')).toEqual({ r1: 0, c1: 0, r2: 1, c2: 1 });
  });
  it('reads what is typed into a cell', () => {
    expect(parseInput('12', true)).toBe(12); expect(parseInput('1,234.5', true)).toBe(1234.5); expect(parseInput('007', true)).toBe('007'); expect(parseInput('25%', true)).toBe(0.25);
    expect(parseInput('true', true)).toBe(true); expect(parseInput('=1+2', true)).toBe('=1+2'); expect(parseInput('', true)).toBeNull(); expect(parseInput('12', false)).toBe('12');
  });
});

describe('number formats', () => {
  const f = (v: number, nf?: string) => formatCell({ v, s: nf ? { nf } : undefined });
  it('shows numbers the way the format says', () => {
    expect(f(0.1 + 0.2)).toBe('0.3'); expect(f(1234.5, '#,##0.00')).toBe('1,234.50'); expect(f(0.256, '0.0%')).toBe('25.6%'); expect(f(4.5, '"$"#,##0.00')).toBe('$4.50');
    expect(f(-3.5, '#,##0.00')).toBe('-3.50'); expect(f(1000, '0.00E+00')).toBe('1.00E+03'); expect(f(5, '0')).toBe('5'); expect(f(1234567, '#,##0')).toBe('1,234,567');
  });
  it('shows dates and times', () => {
    expect(f(46312, 'yyyy-mm-dd')).toBe('2026-10-17'); expect(f(46312, 'd mmm yyyy')).toBe('17 Oct 2026'); expect(f(46312.5625, 'h:mm')).toBe('13:30'); expect(f(46312.5625, 'h:mm AM/PM')).toBe('1:30 PM');
    expect(f(46312, 'dddd, mmmm d')).toBe('Saturday, October 17');
  });
});

describe('reading an .xlsx saved by LibreOffice', () => {
  it('keeps values, formulas with their last value, formats, widths and merges', async () => {
    const { book, warnings } = await importXlsx(fixture('libreoffice-roundtrip.xlsx'));
    expect(warnings).toEqual([]);
    expect(book.sheets.map((s) => s.name)).toEqual(['Budget', 'Notes']);
    expect(cell(book, 0, 'A2').v).toBe('Coffee ☕');
    expect(cell(book, 0, 'A4').v).toBe('Çedilla & <angle>');
    expect(cell(book, 0, 'D2')).toMatchObject({ v: 13.5, f: 'B2*C2' });
    expect(cell(book, 0, 'D6')).toMatchObject({ v: 13.5 + 22.5 + 1234.5, f: 'SUM(D2:D4)' });
    expect(cell(book, 0, 'G2').v).toBe(true);
    expect(formatCell(cell(book, 0, 'C2'))).toBe('$4.50');
    expect(formatCell(cell(book, 0, 'E2'))).toBe('2026-10-17');
    expect(formatCell(cell(book, 0, 'F3'))).toBe('12.5%');
    expect(cell(book, 0, 'A1').s).toMatchObject({ b: true, color: '#ffffff', fill: '#1f6f5c', align: 'center' });
    expect(cell(book, 0, 'A6').s).toMatchObject({ i: true, u: true, font: 'Georgia', size: 14 });
    expect(book.sheets[0].merges).toEqual([{ r1: 7, c1: 0, r2: 7, c2: 2 }]);
    expect(book.sheets[0].colW[0]).toBeGreaterThan(150);
    expect(book.sheets[0].rowH[0]).toBeGreaterThan(35);
    expect(cell(book, 1, 'A1')).toMatchObject({ v: 'Line one\nLine two', s: { wrap: true } });
    expect(cell(book, 1, 'C3').v).toBe(42);
  });
});

describe('reading an .xlsx saved by openpyxl (no calculated values yet)', () => {
  it('keeps the formulas', async () => {
    const { book } = await importXlsx(fixture('python-openpyxl.xlsx'));
    expect(cell(book, 0, 'D2').f).toBe('B2*C2');
    expect(cell(book, 0, 'D2').v).toBeNull();
    expect(cell(book, 0, 'B2').v).toBe(3);
  });
});

describe('writing an .xlsx', () => {
  it('reads back what was written, including formulas, formats and several sheets', async () => {
    const first = (await importXlsx(fixture('libreoffice-roundtrip.xlsx'))).book;
    const again = (await importXlsx(await exportXlsx(first))).book;
    expect(again.sheets.map((s) => s.name)).toEqual(['Budget', 'Notes']);
    expect(again.sheets[0].cells).toEqual(first.sheets[0].cells);
    expect(again.sheets[1].cells).toEqual(first.sheets[1].cells);
    expect(again.sheets[0].merges).toEqual(first.sheets[0].merges);
    expect(again.sheets[0].colW).toEqual(first.sheets[0].colW);
    expect(again.sheets[0].rowH).toEqual(first.sheets[0].rowH);
  });
  it('writes a new workbook with typed values', async () => {
    const b = newWorkbook();
    b.sheets[0].cells[key(0, 0)] = { v: 'a < b & "c"' }; b.sheets[0].cells[key(1, 0)] = { v: 2.5, s: { nf: '0.00', b: true, fill: '#ffcc00' } }; b.sheets[0].cells[key(2, 0)] = { v: false };
    const back = (await importXlsx(await exportXlsx(b))).book;
    expect(back.sheets[0].cells[key(0, 0)].v).toBe('a < b & "c"');
    expect(back.sheets[0].cells[key(1, 0)]).toEqual({ v: 2.5, s: { nf: '0.00', b: true, fill: '#ffcc00' } });
    expect(back.sheets[0].cells[key(2, 0)].v).toBe(false);
  });
  it('refuses something that is not a workbook', async () => { await expect(importXlsx(new TextEncoder().encode('hello'))).rejects.toThrow(); });
});

describe('csv', () => {
  it('parses quotes, newlines inside quotes and both line endings', () => {
    expect(parseCsv('a,"b ""q"" c",d\r\n1,"x\ny",3\n', ',')).toEqual([['a', 'b "q" c', 'd'], ['1', 'x\ny', '3']]);
    expect(parseCsv('a;b\n1;2', ';')).toEqual([['a', 'b'], ['1', '2']]);
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';'); expect(detectDelimiter('a\tb\n1\t2')).toBe('\t'); expect(detectDelimiter('x,"a;b;c;d"')).toBe(',');
  });
  it('saves a file exactly as it was read (text kept as text)', () => {
    for (const src of ['name,qty\r\nAda,007\r\n"x, y",1.50\r\n', 'a;b\n1;2\n', '﻿q,w\n"say ""hi""",2\n']) {
      const { book, crlf, bom } = importCsv(src);
      expect(exportCsv(book, { crlf, bom })).toBe(src);
    }
  });
});
