import { describe, expect, it } from 'vitest';
import { exportXlsx, importXlsx } from '../src/sheets/xlsx.ts';
import { autofill, formatRange, setBorders, setValue } from '../src/sheets/ops.ts';
import { changeDecimals, formatCell } from '../src/sheets/format.ts';
import { findAll, replacedText } from '../src/sheets/find.ts';
import { colName, emptySheet, key, type Edge, type Sheet, rowHeight } from '../src/sheets/model.ts';

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
    s = formatRange(s, { r1: 1, c1: 1, r2: 1, c2: 1 }, { va: 'top', st: true });
    s = { ...s, freeze: { rows: 2, cols: 1 } };
    const again = (await importXlsx(await exportXlsx({ sheets: [s, { ...emptySheet('Rows'), freeze: { rows: 1, cols: 0 } }, emptySheet('Plain')], active: 0 }))).book;
    expect(again.sheets[0].cells[key(0, 0)].s).toMatchObject({ b: true, va: 'middle', bd: { t: { st: 'medium', c: '#c80000' }, b: { st: 'medium', c: '#c80000' }, l: { st: 'medium', c: '#c80000' }, r: { st: 'medium', c: '#c80000' } } });
    expect(again.sheets[0].cells[key(1, 1)].s).toMatchObject({ va: 'top', st: true });
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
    expect(cs[0].x).toBe(256); // column E, 4 x Excel's default 64 px; expect(cs[0].w).toBeGreaterThan(300);
    expect(chartData(book.sheets[0], cs[0]).series.map((s) => s.values)).toEqual([[10, 14, 9, 18], [7, 9, 12, 15]]);
  });
});

import { cfEvaluator, columnValues, hiddenRows, validate } from '../src/sheets/rules.ts';
import { setLink, shiftFormula } from '../src/sheets/ops.ts';

describe('formulas that move', () => {
  it('shift relative references and keep fixed ones', () => {
    expect(shiftFormula('A1+B$2*$C3', 1, 2)).toBe('C2+D$2*$C4');
    expect(shiftFormula('SUM(A1:A5)', 0, 1)).toBe('SUM(B1:B5)');
    expect(shiftFormula('"A1"&LOG10(B2)&Sheet2!C3', 2, 0)).toBe('"A1"&LOG10(B4)&Sheet2!C5');
    expect(shiftFormula('A1', -1, 0)).toBe('#REF!');
    expect(autofill(setValue(setValue(emptySheet('S'), 0, 1, null, { f: 'A1*2' }), 0, 0, 5), { r1: 0, c1: 1, r2: 0, c2: 1 }, { r1: 0, c1: 1, r2: 2, c2: 1 }).cells[key(2, 1)].f).toBe('A3*2');
  });
});
describe('links, rules and filters', () => {
  it('keep a link when the text changes and when values are cleared', () => {
    let s = setLink(setValue(emptySheet('S'), 0, 0, 'Ann'), { r1: 0, c1: 0, r2: 0, c2: 0 }, 'https://a.example');
    s = setValue(s, 0, 0, 'Anna'); expect(s.cells[key(0, 0)]).toEqual({ v: 'Anna', link: 'https://a.example' });
    expect(setLink(s, { r1: 0, c1: 0, r2: 0, c2: 0 }, undefined).cells[key(0, 0)]).toEqual({ v: 'Anna' });
    expect(setLink(emptySheet('S'), { r1: 1, c1: 1, r2: 1, c2: 1 }, 'mailto:x@y.z').cells[key(1, 1)]).toEqual({ v: 'mailto:x@y.z', link: 'mailto:x@y.z' });
  });
  it('colour cells by rule, first match wins, scales span the range', () => {
    const s: Sheet = { ...grid([[5, 1], [12, 3], ['Bob', 5]]), cf: [
      { id: 'a', range: { r1: 0, c1: 0, r2: 2, c2: 0 }, kind: 'gt', v1: '10', fill: '#ff0000' }, { id: 'b', range: { r1: 0, c1: 0, r2: 2, c2: 0 }, kind: 'text', v1: 'BO', fill: '#00ff00' },
      { id: 'c', range: { r1: 0, c1: 1, r2: 2, c2: 1 }, kind: 'scale', lo: '#000000', hi: '#ffffff' }] };
    const ev = cfEvaluator(s)!;
    expect([ev(0, 0), ev(1, 0), ev(2, 0)]).toEqual([undefined, { fill: '#ff0000' }, { fill: '#00ff00' }]);
    expect([ev(0, 1)?.fill, ev(1, 1)?.fill, ev(2, 1)?.fill]).toEqual(['#000000', '#808080', '#ffffff']);
    expect(cfEvaluator(grid([[1]]))).toBeNull();
  });
  it('refuse what a validation does not allow', () => {
    const s: Sheet = { ...grid([['x', 'y']]), dv: [{ range: { r1: 0, c1: 2, r2: 5, c2: 2 }, kind: 'list', items: ['red', 'Green'], blank: true }, { range: { r1: 0, c1: 3, r2: 5, c2: 3 }, kind: 'whole', min: 1, max: 10, blank: false }, { range: { r1: 0, c1: 4, r2: 5, c2: 4 }, kind: 'list', source: 'A1:B1', blank: true }] };
    expect([validate(s, 1, 2, 'RED'), validate(s, 1, 2, ''), validate(s, 1, 2, 'blue')?.slice(0, 11)]).toEqual([null, null, 'Pick one of']);
    expect([validate(s, 0, 3, '5'), validate(s, 0, 3, '11') !== null, validate(s, 0, 3, '2.5') !== null, validate(s, 0, 3, '') !== null, validate(s, 0, 9, 'anything')]).toEqual([null, true, true, true, null]);
    expect([validate(s, 0, 4, 'y'), validate(s, 0, 4, 'z') !== null]).toEqual([null, true]);
  });
  it('hide the rows a filter does not show', () => {
    const s: Sheet = { ...grid([['Name', 'Qty'], ['Ann', 5], ['Bob', 12], ['Cy', 5]]), filter: { range: { r1: 0, c1: 0, r2: 3, c2: 1 }, show: { 1: ['5'] } } };
    expect([...hiddenRows(s)]).toEqual([2]);
    expect(columnValues(s, s.filter!, 1)).toEqual([{ text: '5', n: 2 }, { text: '12', n: 1 }]);
    expect(hiddenRows({ ...s, filter: { ...s.filter!, show: {} } }).size).toBe(0);
  });
  it('survive a save: links, rules, validation, filter, area and scatter charts', async () => {
    const base = grid([['Name', 'Qty'], ['Ann', 5], ['Bob', 12], ['Cy', 5]]);
    const s: Sheet = { ...setLink(base, { r1: 1, c1: 0, r2: 1, c2: 0 }, 'https://a.example/?q=1&r=2'), name: 'Rules',
      cf: [{ id: 'a', range: { r1: 1, c1: 1, r2: 3, c2: 1 }, kind: 'between', v1: '5', v2: '9', fill: '#ffd6d6', color: '#9c0006', bold: true }, { id: 'b', range: { r1: 1, c1: 0, r2: 3, c2: 0 }, kind: 'text', v1: 'an', fill: '#00ff00' }, { id: 'c', range: { r1: 1, c1: 1, r2: 3, c2: 1 }, kind: 'scale', lo: '#ffffff', hi: '#63be7b' }, { id: 'd', range: { r1: 1, c1: 0, r2: 3, c2: 0 }, kind: 'eq', v1: 'Bob', fill: '#aaaaaa' }],
      dv: [{ range: { r1: 1, c1: 3, r2: 3, c2: 3 }, kind: 'list', items: ['a', 'b, c'.split(',')[0]], blank: true }, { range: { r1: 1, c1: 1, r2: 3, c2: 1 }, kind: 'whole', min: 1, max: 100, blank: false, message: 'Whole numbers 1 to 100' }, { range: { r1: 1, c1: 4, r2: 3, c2: 4 }, kind: 'list', source: 'A2:A4', blank: true }],
      filter: { range: { r1: 0, c1: 0, r2: 3, c2: 1 }, show: { 1: ['5'] } },
      charts: [{ id: 'x', type: 'area', title: 'A', range: { r1: 0, c1: 0, r2: 3, c2: 1 }, header: true, labels: true, x: 400, y: 10, w: 300, h: 200 }, { id: 'y', type: 'scatter', title: 'S', range: { r1: 0, c1: 1, r2: 3, c2: 1 }, header: true, labels: false, x: 400, y: 240, w: 300, h: 200 }] };
    const { book, warnings } = await importXlsx(await exportXlsx({ sheets: [s], active: 0 }));
    expect(warnings).toEqual([]);
    const got = book.sheets[0];
    expect(got.cells[key(1, 0)].link).toBe('https://a.example/?q=1&r=2');
    expect(got.cf!.map((r) => [r.kind, r.v1, r.v2, r.fill, r.color, r.bold, r.lo, r.hi])).toEqual([['between', '5', '9', '#ffd6d6', '#9c0006', true, undefined, undefined], ['text', 'an', undefined, '#00ff00', undefined, undefined, undefined, undefined], ['scale', undefined, undefined, undefined, undefined, undefined, '#ffffff', '#63be7b'], ['eq', 'Bob', undefined, '#aaaaaa', undefined, undefined, undefined, undefined]]);
    expect(got.dv!.map((v) => [v.kind, v.items, v.source, v.min, v.max, v.blank, v.message])).toEqual([['list', ['a', 'b'], undefined, undefined, undefined, true, undefined], ['whole', undefined, undefined, 1, 100, false, 'Whole numbers 1 to 100'], ['list', undefined, 'A2:A4', undefined, undefined, true, undefined]]);
    expect(got.filter).toEqual({ range: { r1: 0, c1: 0, r2: 3, c2: 1 }, show: { 1: ['5'] } });
    expect(got.charts!.map((c) => c.type)).toEqual(['area', 'scatter']);
  });
  it('are read from a workbook written by openpyxl', async () => {
    const { book, warnings } = await importXlsx(new Uint8Array(readFileSync(join(import.meta.dirname, 'fixtures', 'openpyxl-rules.xlsx'))));
    expect(warnings).toEqual([]);
    const s = book.sheets[0];
    expect([s.cells[key(1, 0)].link, s.cells[key(2, 0)].link]).toEqual(['https://example.com/ann', 'mailto:bob@example.com']);
    expect(s.cf!.map((r) => [r.kind, rangeOf(r.range), r.v1, r.v2, r.fill, r.bold])).toEqual([['gt', 'B2:B5', '10', undefined, '#ffc7ce', true], ['scale', 'C2:C5', undefined, undefined, undefined, undefined], ['between', 'A2:A5', 'A', 'C', '#dddddd', undefined]]);
    expect(s.dv!.map((v) => [v.kind, v.items, v.min, v.max, v.blank, rangeOf(v.range)])).toEqual([['list', ['red', 'green', 'blue'], undefined, undefined, true, 'E2:E5'], ['whole', undefined, 1, 100, false, 'B2:B5']]);
    expect(s.filter).toEqual({ range: { r1: 0, c1: 0, r2: 4, c2: 2 }, show: { 1: ['5', '8'] } });
    expect(s.charts!.map((c) => [c.type, c.header, c.labels])).toEqual([['area', true, true], ['scatter', true, true]]);
    expect(chartData(s, s.charts![1]).series[0].values).toEqual([1.5, 2.5, 3, 4]);
  });
});
const rangeOf = (g: { r1: number; c1: number; r2: number; c2: number }) => `${colName(g.c1)}${g.r1 + 1}:${colName(g.c2)}${g.r2 + 1}`;

import { pasteFormats, setFormat, valuesOf } from '../src/sheets/ops.ts';
describe('paint format and paste special', () => {
  it('copy only the look, or only the values', () => {
    const src = formatRange(setValue(emptySheet('S'), 0, 0, 5), { r1: 0, c1: 0, r2: 0, c2: 0 }, { b: true, fill: '#ff0000' });
    const painted = setFormat(grid([['x', 'y']]), { r1: 0, c1: 0, r2: 0, c2: 1 }, src.cells[key(0, 0)].s);
    expect(painted.cells[key(0, 1)]).toEqual({ v: 'y', s: { b: true, fill: '#ff0000' } });
    expect(setFormat(painted, { r1: 0, c1: 0, r2: 0, c2: 0 }, undefined).cells[key(0, 0)]).toEqual({ v: 'x' });
    painted.cells[key(0, 0)].s!.b = false; expect(painted.cells[key(0, 1)].s!.b).toBe(true); // each cell has its own copy
    const pf = pasteFormats(grid([['keep'], ['me']]), { r: 0, c: 0 }, [[{ v: 'ignored', s: { i: true } }]]);
    expect(pf.cells[key(0, 0)]).toEqual({ v: 'keep', s: { i: true } }); expect(pf.cells[key(1, 0)]).toEqual({ v: 'me' });
    expect(valuesOf([[{ v: 3, f: 'A1+2', s: { b: true } }]])).toEqual([[{ v: 3 }]]);
  });
});

import JSZip from 'jszip';
import { colLeft, colWidth, rowHeight, rowTop } from '../src/sheets/model.ts';
describe('column widths and row heights come through from other programs', () => {
  const google = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetFormatPr customHeight="1" defaultColWidth="12.63" defaultRowHeight="15.75"/><cols><col customWidth="1" min="1" max="1" width="20.0"/><col customWidth="1" min="2" max="4" width="8.5"/></cols><sheetData><row r="1" ht="30" customHeight="1"><c r="A1" t="inlineStr"><is><t>tall</t></is></c></row><row r="2" ht="15.75" customHeight="1"><c r="A2"><v>1</v></c></row><row r="3" ht="42"><c r="A3"><v>2</v></c></row></sheetData></worksheet>`;
  const xlsxOf = async (sheetXml: string) => {
    const z = new JSZip();
    z.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
    z.file('xl/workbook.xml', '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="S" sheetId="1" r:id="rId1"/></sheets></workbook>');
    z.file('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="x/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
    z.file('xl/worksheets/sheet1.xml', sheetXml);
    return await z.generateAsync({ type: 'uint8array' });
  };
  it("keep a Google Sheets file's own default sizes, widths and heights (width x 7 px, points x 4/3)", async () => {
    const s = (await importXlsx(await xlsxOf(google))).book.sheets[0];
    expect([s.defColW, s.defRowH]).toEqual([88, 21]);
    expect([colWidth(s, 0), colWidth(s, 1), colWidth(s, 3), colWidth(s, 4)]).toEqual([140, 60, 60, 88]);
    expect([rowHeight(s, 0), rowHeight(s, 1), rowHeight(s, 2), rowHeight(s, 3)]).toEqual([40, 21, 56, 21]); // a height without customHeight (grown to fit text) is kept too
    expect([colLeft(s, 2), rowTop(s, 3)]).toEqual([200, 117]);
  });
  it('save them back as they were', async () => {
    const first = (await importXlsx(await xlsxOf(google))).book;
    const again = (await importXlsx(await exportXlsx(first))).book.sheets[0];
    expect([again.defColW, again.defRowH]).toEqual([88, 21]);
    expect([0, 1, 2, 4].map((c) => colWidth(again, c))).toEqual([140, 60, 60, 88]);
    expect([0, 1, 2, 3].map((r) => rowHeight(again, r))).toEqual([40, 21, 56, 21]);
  });
  it('use Excel\'s defaults when the file names none, and Google\'s for a new sheet', async () => {
    const s = (await importXlsx(await xlsxOf('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/></worksheet>'))).book.sheets[0];
    expect([s.defColW, s.defRowH]).toEqual([64, 20]);
    expect([colWidth(emptySheet('N'), 0), rowHeight(emptySheet('N'), 0)]).toEqual([100, 21]);
  });
});

describe('a row without a height is sized by its biggest font', () => {
  it('Google Finances export: the 40 pt title row is tall, a plain row is the default', async () => {
    const { book } = await importXlsx(new Uint8Array(readFileSync(join(__dirname, 'fixtures/google-finances.xlsx'))));
    const s = book.sheets[0];
    expect(rowHeight(s, 0)).toBeGreaterThanOrEqual(67);
    expect(rowHeight(s, 2)).toBe(15); // ht="11.25" kept
    expect(rowHeight(s, 5)).toBe(21);
  });
});
