import { describe, expect, it } from 'vitest';
import { exportXlsx, importXlsx } from '../src/sheets/xlsx.ts';
import { autofill, formatRange, setBorders, setValue } from '../src/sheets/ops.ts';
import { changeDecimals, formatCell } from '../src/sheets/format.ts';
import { findAll, replacedText } from '../src/sheets/find.ts';
import { emptySheet, key, type Edge, type Sheet } from '../src/sheets/model.ts';

const grid = (rows: (string | number | null)[][]): Sheet => { let s = emptySheet('S'); rows.forEach((r, i) => r.forEach((v, j) => { if (v !== null) s = setValue(s, i, j, v); })); return s; };
const line: Edge = { st: 'thin', c: '#000000' };
const col = (s: Sheet, c: number, n: number) => Array.from({ length: n }, (_, r) => s.cells[key(r, c)]?.v ?? null);

describe('borders', () => {
  it('go round the outside, between cells, or on one side', () => {
    const g = { r1: 0, c1: 0, r2: 1, c2: 1 };
    let s = setBorders(emptySheet('S'), g, 'outer', line);
    expect(s.cells[key(0, 0)].s!.bd).toEqual({ t: line, l: line });
    expect(s.cells[key(1, 1)].s!.bd).toEqual({ b: line, r: line });
    s = setBorders(s, g, 'inner', { st: 'dashed', c: '#ff0000' });
    expect(s.cells[key(0, 0)].s!.bd).toEqual({ t: line, l: line, b: { st: 'dashed', c: '#ff0000' }, r: { st: 'dashed', c: '#ff0000' } });
    s = setBorders(s, g, 'none', line);
    expect(Object.keys(s.cells)).toEqual([]);
    s = setBorders(emptySheet('S'), { r1: 2, c1: 2, r2: 4, c2: 2 }, 'bottom', line);
    expect(Object.keys(s.cells)).toEqual([key(4, 2)]);
  });
  it('survive a save: borders, vertical alignment and frozen panes', async () => {
    let s = setValue(emptySheet('Data'), 0, 0, 'Head');
    s = setBorders(s, { r1: 0, c1: 0, r2: 1, c2: 1 }, 'all', { st: 'medium', c: '#c80000' });
    s = formatRange(s, { r1: 0, c1: 0, r2: 0, c2: 0 }, { va: 'middle', b: true });
    s = formatRange(s, { r1: 1, c1: 1, r2: 1, c2: 1 }, { va: 'top' });
    s = { ...s, freeze: { rows: 2, cols: 1 } };
    const again = (await importXlsx(await exportXlsx({ sheets: [s, { ...emptySheet('Rows'), freeze: { rows: 1, cols: 0 } }, emptySheet('Plain')], active: 0 }))).book;
    expect(again.sheets[0].cells[key(0, 0)].s).toMatchObject({ b: true, va: 'middle', bd: { t: { st: 'medium', c: '#c80000' }, b: { st: 'medium', c: '#c80000' }, l: { st: 'medium', c: '#c80000' }, r: { st: 'medium', c: '#c80000' } } });
    expect(again.sheets[0].cells[key(1, 1)].s!.va).toBe('top');
    expect(again.sheets[0].freeze).toEqual({ rows: 2, cols: 1 });
    expect(again.sheets[1].freeze).toEqual({ rows: 1, cols: 0 });
    expect(again.sheets[2].freeze).toBeUndefined();
  });
});

describe('the fill handle', () => {
  it('goes on with a series, counts text, repeats the rest, in every direction', () => {
    let s = grid([[1, 'Item 1', 'x', 5], [3, 'Item 2', 'y', 5]]);
    s = autofill(s, { r1: 0, c1: 0, r2: 1, c2: 3 }, { r1: 0, c1: 0, r2: 4, c2: 3 });
    expect(col(s, 0, 5)).toEqual([1, 3, 5, 7, 9]);
    expect(col(s, 1, 5)).toEqual(['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5']);
    expect(col(s, 2, 5)).toEqual(['x', 'y', 'x', 'y', 'x']);
    expect(col(s, 3, 5)).toEqual([5, 5, 5, 5, 5]);
    // a single date goes on by a day, and keeps its format
    const grown = autofill(setValue(formatRange(setValue(emptySheet('S'), 0, 0, 46000), { r1: 0, c1: 0, r2: 0, c2: 0 }, { nf: 'yyyy-mm-dd' }), 1, 0, 7), { r1: 0, c1: 0, r2: 0, c2: 0 }, { r1: 0, c1: 0, r2: 2, c2: 0 });
    expect(col(grown, 0, 3)).toEqual([46000, 46001, 46002]);
    expect(grown.cells[key(2, 0)].s!.nf).toBe('yyyy-mm-dd');
    // upwards and leftwards continue backwards
    const up = autofill(grid([[null], [null], [10], [20]]), { r1: 2, c1: 0, r2: 3, c2: 0 }, { r1: 0, c1: 0, r2: 3, c2: 0 });
    expect(col(up, 0, 4)).toEqual([-10, 0, 10, 20]);
    const left = autofill(grid([[null, null, 'a', 'b']]), { r1: 0, c1: 2, r2: 0, c2: 3 }, { r1: 0, c1: 0, r2: 0, c2: 3 });
    expect([0, 1, 2, 3].map((c) => left.cells[key(0, c)]?.v)).toEqual(['a', 'b', 'a', 'b']);
  });
});

describe('number format buttons', () => {
  it('add and remove decimal places', () => {
    expect(changeDecimals(null, 1)).toBe('0.0'); expect(changeDecimals('0.0', 1)).toBe('0.00'); expect(changeDecimals('#,##0.00', -1)).toBe('#,##0.0'); expect(changeDecimals('#,##0.0', -1)).toBe('#,##0');
    expect(changeDecimals('0%', 1)).toBe('0.0%'); expect(changeDecimals('"$"#,##0.00', 1)).toBe('"$"#,##0.000'); expect(changeDecimals('#,##0', -1)).toBe('#,##0');
    expect(changeDecimals('yyyy-mm-dd', 1)).toBe('yyyy-mm-dd'); expect(changeDecimals('#,##0.00;-#,##0.00', -1)).toBe('#,##0.0;-#,##0.0');
    expect(formatCell({ v: 1234.5, s: { nf: changeDecimals('#,##0', 1)! } })).toBe('1,234.5');
  });
});

describe('find and replace', () => {
  const s = grid([['Apple pie', 12], ['apple', 'Pineapple'], [null, 'APPLE']]);
  it('finds cells in reading order, with case and whole-cell options', () => {
    expect(findAll(s, 'apple', { matchCase: false, wholeCell: false })).toEqual([{ r: 0, c: 0 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 2, c: 1 }]);
    expect(findAll(s, 'apple', { matchCase: true, wholeCell: false })).toEqual([{ r: 1, c: 0 }, { r: 1, c: 1 }]);
    expect(findAll(s, 'apple', { matchCase: false, wholeCell: true })).toEqual([{ r: 1, c: 0 }, { r: 2, c: 1 }]);
    expect(findAll(s, '12', { matchCase: false, wholeCell: true })).toEqual([{ r: 0, c: 1 }]);
    expect(findAll(s, '', { matchCase: false, wholeCell: false })).toEqual([]);
  });
  it('gives the replaced text, special characters included', () => {
    const o = { matchCase: false, wholeCell: false };
    expect(replacedText(s, { r: 0, c: 0 }, 'apple', 'cherry', o)).toBe('cherry pie');
    expect(replacedText(s, { r: 1, c: 1 }, 'apple', '$&', o)).toBe('Pine$&');
    expect(replacedText(s, { r: 0, c: 1 }, '1', '9', o)).toBe('92');
    expect(replacedText(s, { r: 0, c: 0 }, 'zzz', 'y', o)).toBeNull();
    expect(findAll(grid([['a.b', 'axb']]), 'a.b', { matchCase: false, wholeCell: true })).toEqual([{ r: 0, c: 0 }]);
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chartData, currentRegion, guessHeaders, niceAxis, shiftCharts } from '../src/sheets/charts.ts';
import { deleteCols, deleteRows, insertRows } from '../src/sheets/ops.ts';
import type { Chart } from '../src/sheets/model.ts';

const chart = (over: Partial<Chart> = {}): Chart => ({ id: 'c1', type: 'column', title: 'T', range: { r1: 0, c1: 0, r2: 3, c2: 2 }, header: true, labels: true, x: 300, y: 40, w: 480, h: 300, ...over });
const sales = grid([['Month', 'North', 'South'], ['Jan', 10, 7], ['Feb', 14, 'n/a'], ['Mar', 9, 12]]);

describe('charts', () => {
  it('read their numbers from the cells', () => {
    expect(chartData(sales, chart())).toEqual({ cats: ['Jan', 'Feb', 'Mar'], series: [{ name: 'North', values: [10, 14, 9] }, { name: 'South', values: [7, null, 12] }] });
    expect(chartData(sales, chart({ header: false, labels: false })).series[0]).toEqual({ name: 'Series 1', values: [null, null, null, null] });
    expect(chartData(sales, chart({ range: { r1: 1, c1: 1, r2: 3, c2: 1 }, header: false, labels: false }))).toEqual({ cats: ['1', '2', '3'], series: [{ name: 'Series 1', values: [10, 14, 9] }] });
  });
  it('guess what is a header and what is a label, and find the block around a cell', () => {
    expect(guessHeaders(sales, { r1: 0, c1: 0, r2: 3, c2: 2 })).toEqual({ header: true, labels: true });
    expect(guessHeaders(grid([[1, 2], [3, 4]]), { r1: 0, c1: 0, r2: 1, c2: 1 })).toEqual({ header: false, labels: false });
    expect(currentRegion(sales, { r: 2, c: 1 })).toEqual({ r1: 0, c1: 0, r2: 3, c2: 2 });
    expect(currentRegion(sales, { r: 9, c: 9 })).toEqual({ r1: 9, c1: 9, r2: 9, c2: 9 });
  });
  it('have tidy axes', () => {
    expect(niceAxis(0, 18)).toMatchObject({ lo: 0, hi: 20, step: 5 }); expect(niceAxis(-3, 7).ticks).toEqual([-4, -2, 0, 2, 4, 6, 8]); expect(niceAxis(0, 0).hi).toBeGreaterThan(0);
  });
  it('follow inserted and deleted rows and columns', () => {
    const s = { ...sales, charts: [chart()] };
    expect(insertRows(s, 2).charts![0].range).toEqual({ r1: 0, c1: 0, r2: 4, c2: 2 });
    expect(insertRows(s, 0).charts![0].range).toEqual({ r1: 1, c1: 0, r2: 4, c2: 2 });
    expect(deleteRows(s, 1, 1).charts![0].range).toEqual({ r1: 0, c1: 0, r2: 2, c2: 2 });
    expect(deleteCols(s, 2, 2).charts![0].range).toEqual({ r1: 0, c1: 0, r2: 3, c2: 1 });
    expect(deleteCols(s, 0, 2).charts).toEqual([]);
    expect(shiftCharts(undefined, 'r', { insert: { at: 0, n: 1 } })).toBeUndefined();
  });
  it('survive a save: all four kinds, with their title, range and place', async () => {
    const kinds: Chart[] = (['column', 'bar', 'line', 'pie'] as const).map((type, i) => chart({ id: `k${i}`, type, title: `A "${type}" <chart> & more`, x: 300 + i * 20, y: 40 + i * 330 }));
    const again = (await importXlsx(await exportXlsx({ sheets: [{ ...sales, name: "Q1 'sales'", charts: kinds }, { ...emptySheet('Other') }], active: 0 }))).book;
    expect(again.sheets[1].charts).toBeUndefined();
    const got = again.sheets[0].charts!;
    expect(got.map((c) => [c.type, c.title, c.header, c.labels])).toEqual(kinds.map((c) => [c.type, c.title, true, true]));
    expect(got[0].range).toEqual({ r1: 0, c1: 0, r2: 3, c2: 2 });
    expect(got[2]).toMatchObject({ x: 340, y: 700, w: 480, h: 300 });
    // an unlabelled one with no header
    const bare = (await importXlsx(await exportXlsx({ sheets: [{ ...sales, charts: [chart({ range: { r1: 1, c1: 1, r2: 3, c2: 2 }, header: false, labels: false })] }], active: 0 }))).book.sheets[0].charts![0];
    expect(bare).toMatchObject({ header: false, labels: false, range: { r1: 1, c1: 1, r2: 3, c2: 2 } });
  });
  it('are read from a workbook written by openpyxl', async () => {
    const { book, warnings } = await importXlsx(new Uint8Array(readFileSync(join(import.meta.dirname, 'fixtures', 'openpyxl-charts.xlsx'))));
    expect(warnings).toEqual([]);
    const cs = book.sheets[0].charts!;
    expect(cs.map((c) => [c.type, c.title, c.header, c.labels])).toEqual([['column', 'Sales by month', true, true], ['pie', 'Share', true, true], ['line', '', false, false]]);
    expect(cs[0].range).toEqual({ r1: 0, c1: 0, r2: 4, c2: 2 }); expect(cs[2].range).toEqual({ r1: 1, c1: 2, r2: 4, c2: 2 });
    expect(cs[0].x).toBeGreaterThan(300); expect(cs[0].w).toBeGreaterThan(300);
    expect(chartData(book.sheets[0], cs[0]).series.map((s) => s.values)).toEqual([[10, 14, 9, 18], [7, 9, 12, 15]]);
  });
});
