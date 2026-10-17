import { describe, expect, it } from 'vitest';
import { clearRange, deleteCols, deleteRows, fill, formatRange, fromTsv, insertCols, insertRows, mergeRange, setValue, sortRange, stats, toTsv } from '../src/sheets/ops.ts';
import { emptySheet, key, type Sheet } from '../src/sheets/model.ts';
import { formatCell } from '../src/sheets/format.ts';

const grid = (rows: (string | number | null)[][]): Sheet => { let s = emptySheet('S'); rows.forEach((r, i) => r.forEach((v, j) => { if (v !== null) s = setValue(s, i, j, v); })); return s; };
const col = (s: Sheet, c: number, n: number) => Array.from({ length: n }, (_, r) => s.cells[key(r, c)]?.v ?? null);

describe('editing a sheet', () => {
  it('does not touch the sheet it started from', () => {
    const a = grid([[1, 2]]); const b = setValue(a, 0, 0, 9);
    expect(a.cells[key(0, 0)].v).toBe(1); expect(b.cells[key(0, 0)].v).toBe(9);
  });
  it('clears values but keeps formats; formats a range and toggles', () => {
    let s = grid([[1, 2], [3, 4]]);
    s = formatRange(s, { r1: 0, c1: 0, r2: 0, c2: 1 }, { b: true, nf: '0.00' });
    expect(formatCell(s.cells[key(0, 0)])).toBe('1.00');
    s = clearRange(s, { r1: 0, c1: 0, r2: 0, c2: 0 });
    expect(s.cells[key(0, 0)]).toEqual({ v: null, s: { b: true, nf: '0.00' } });
    s = formatRange(s, { r1: 0, c1: 0, r2: 0, c2: 0 }, { b: false, nf: undefined });
    expect(s.cells[key(0, 0)]).toBeUndefined();
  });
  it('inserts and deletes rows and columns, moving cells, sizes and merges', () => {
    let s = grid([['a', 'b'], ['c', 'd'], ['e', 'f']]);
    s = { ...s, rowH: { 2: 50 }, colW: { 1: 200 }, merges: [{ r1: 1, c1: 0, r2: 2, c2: 0 }] };
    const ins = insertRows(s, 1);
    expect(col(ins, 0, 4)).toEqual(['a', null, 'c', 'e']); expect(ins.rowH).toEqual({ 3: 50 }); expect(ins.merges).toEqual([{ r1: 2, c1: 0, r2: 3, c2: 0 }]);
    const del = deleteRows(s, 1, 1);
    expect(col(del, 0, 3)).toEqual(['a', 'e', null]); expect(del.rowH).toEqual({ 1: 50 }); expect(del.merges).toEqual([]);
    const cins = insertCols(s, 0);
    expect(cins.cells[key(0, 1)].v).toBe('a'); expect(cins.colW).toEqual({ 2: 200 });
    const cdel = deleteCols(s, 0, 0);
    expect(cdel.cells[key(0, 0)].v).toBe('b'); expect(cdel.colW).toEqual({ 0: 200 });
  });
  it('sorts rows by a column, empty last, numbers before text, optionally under a header', () => {
    const s = grid([['name', 'n'], ['b', 10], ['a', 2], [null, null], ['c', 1]]);
    const asc = sortRange(s, { r1: 0, c1: 0, r2: 4, c2: 1 }, 1, true, true);
    expect(col(asc, 0, 5)).toEqual(['name', 'c', 'a', 'b', null]);
    const desc = sortRange(s, { r1: 0, c1: 0, r2: 4, c2: 1 }, 0, false, true);
    expect(col(desc, 0, 5)).toEqual(['name', 'c', 'b', 'a', null]);
  });
  it('fills down and merges', () => {
    const s = fill(grid([[5, 'x'], [null, null], [null, null]]), { r1: 0, c1: 0, r2: 2, c2: 1 }, 'down');
    expect(col(s, 0, 3)).toEqual([5, 5, 5]); expect(col(s, 1, 3)).toEqual(['x', 'x', 'x']);
    const m = mergeRange(grid([[1, 2], [3, 4]]), { r1: 0, c1: 0, r2: 1, c2: 1 });
    expect(m.merges).toHaveLength(1); expect(m.cells[key(0, 1)]).toBeUndefined();
  });
  it('turns a range into tab-separated text and back, quoting where needed', () => {
    const s = grid([['a', 'b\tc'], ['say "hi"', 'x\ny']]);
    const t = toTsv(s, { r1: 0, c1: 0, r2: 1, c2: 1 }, (c) => (c ? String(c.v) : ''));
    expect(fromTsv(t)).toEqual([['a', 'b\tc'], ['say "hi"', 'x\ny']]);
  });
  it('summarises the numbers of a range', () => {
    expect(stats(grid([[1, 'x'], [2.5, '3']]), { r1: 0, c1: 0, r2: 1, c2: 1 })).toEqual({ count: 3, sum: 6.5, avg: 6.5 / 3, min: 1, max: 3 });
    expect(stats(grid([['a']]), { r1: 0, c1: 0, r2: 0, c2: 0 })).toBeNull();
  });
});
