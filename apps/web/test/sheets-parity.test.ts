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
