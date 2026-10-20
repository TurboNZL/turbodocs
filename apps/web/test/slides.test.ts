import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { exportPptx, importPptx } from '../src/slides/pptx.ts';
import { textOf, type Deck, type TextEl, type ImageEl } from '../src/slides/model.ts';

const fixture = (n: string) => new Uint8Array(readFileSync(join(import.meta.dirname, 'fixtures', n)));
const texts = (d: Deck, i: number) => d.slides[i].els.filter((e): e is TextEl => e.kind === 'text');

describe('reading a .pptx written by python-pptx', () => {
  it('takes position, size and text from the layout placeholders, plus notes and a background', async () => {
    const { deck, warnings } = await importPptx(fixture('python-pptx.pptx'));
    expect(warnings).toEqual([]);
    expect(deck).toMatchObject({ w: 960, h: 720 });
    expect(deck.slides).toHaveLength(3);
    const [title, sub] = texts(deck, 0);
    expect(textOf(title)).toBe('Quarterly review ☕'); expect(title.w).toBeGreaterThan(700); expect(title.paras[0].runs[0].size).toBe(44); expect(title.paras[0].align).toBe('center');
    expect(textOf(sub)).toBe('Results & plans <2026>');
    expect(deck.slides[0].notes).toBe('Say hello.\nThen the numbers.');
    const [t2, body] = texts(deck, 1);
    expect(textOf(t2)).toBe('Agenda');
    expect(body.paras.map((p) => [textOf({ ...body, paras: [p] }), p.bullet, p.level ?? 0])).toEqual([['First point', true, 0], ['Nested point', true, 1], ['Third point', true, 0]]);
    expect(deck.slides[2].bg).toBe('#f4f1e8');
  });
  it('reads runs, shapes and pictures', async () => {
    const { deck } = await importPptx(fixture('python-pptx.pptx'));
    const els = deck.slides[2].els;
    const box = els.find((e): e is TextEl => e.kind === 'text' && textOf(e).includes('Bold red'))!;
    expect(box.paras[0].align).toBe('center');
    expect(box.paras[0].runs).toEqual([{ text: 'Bold red ', size: 32, b: true, color: '#c80000' }, { text: 'and italic Georgia', size: 24, i: true, font: 'Georgia' }]);
    expect(box.paras[1].runs[0]).toMatchObject({ text: 'Second line', u: true });
    const shapes = els.filter((e): e is TextEl => e.kind === 'text' && !textOf(e));
    expect(shapes.map((s) => [s.geometry ?? 'rect', s.fill])).toEqual([['rect', '#1f6f5c'], ['ellipse', '#ffcc00']]);
    const pic = els.find((e): e is ImageEl => e.kind === 'image')!;
    expect(pic.src).toMatch(/^data:image\/png;base64,/); expect(Math.round(pic.w)).toBe(192);
  });
});

describe('reading a .pptx saved by LibreOffice', () => {
  it('finds the same slides', async () => {
    const { deck } = await importPptx(fixture('libreoffice-roundtrip.pptx'));
    expect(deck.slides).toHaveLength(3);
    expect(texts(deck, 0).map(textOf)).toContain('Quarterly review ☕');
    expect(deck.slides[2].els.some((e) => e.kind === 'image')).toBe(true);
    expect(deck.slides[0].notes).toContain('Say hello.');
  });
});

describe('writing a .pptx', () => {
  it('reads back what was written', async () => {
    const first = (await importPptx(fixture('python-pptx.pptx'))).deck;
    const again = (await importPptx(await exportPptx(first))).deck;
    expect(again.slides).toHaveLength(3);
    expect(again.w).toBe(first.w);
    for (let i = 0; i < 3; i++) {
      expect(texts(again, i).map(textOf)).toEqual(texts(first, i).map(textOf));
      expect(again.slides[i].notes).toBe(first.slides[i].notes);
    }
    const a = texts(again, 2).find((e) => textOf(e).includes('Bold red'))!, b = texts(first, 2).find((e) => textOf(e).includes('Bold red'))!;
    expect(a.paras[0].runs.map((r) => [r.text, r.size, !!r.b, !!r.i, r.color, r.font])).toEqual(b.paras[0].runs.map((r) => [r.text, r.size, !!r.b, !!r.i, r.color, r.font]));
    expect(Math.abs(a.x - b.x)).toBeLessThan(1.5); expect(Math.abs(a.w - b.w)).toBeLessThan(1.5);
    expect(again.slides[2].bg).toBe('#f4f1e8');
    expect(again.slides[2].els.filter((e) => e.kind === 'image')).toHaveLength(1);
    const body = texts(again, 1)[1];
    expect(body.paras.map((p) => [p.bullet, p.level ?? 0])).toEqual([[true, 0], [true, 1], [true, 0]]);
  });
  it('refuses something that is not a presentation', async () => { await expect(importPptx(new TextEncoder().encode('nope'))).rejects.toThrow(); });
});

import { LAYOUTS, applyLayout, layoutById, newDeck, slideFromLayout } from '../src/slides/layouts.ts';
import { deleteCol, deleteRow, insertCol, insertRow, newTable, resizeTable, setCell } from '../src/slides/tableOps.ts';
import { para, textBox, type LineEl, type TableEl } from '../src/slides/model.ts';

const D = { w: 1280, h: 720 };
describe('layouts', () => {
  it('make slides of empty placeholders that are not saved', async () => {
    for (const l of LAYOUTS) expect(slideFromLayout(l, D).els).toHaveLength(l.slots.length);
    const deck = newDeck(); deck.slides.push(slideFromLayout(layoutById('two'), D));
    const again = (await importPptx(await exportPptx(deck))).deck;
    expect(again.slides).toHaveLength(2);
    expect(again.slides[1].els).toHaveLength(0);
  });
  it('move the text of a slide into the matching boxes when the layout changes', () => {
    const s = slideFromLayout(layoutById('content'), D);
    const [title, body] = s.els as TextEl[];
    const filled = { ...s, els: [{ ...title, paras: [para('Plan', { size: 36, b: true })] }, { ...body, paras: [para('One', { size: 24 }, { bullet: true }), para('Two', { size: 24 }, { bullet: true })] }] };
    const two = applyLayout(filled, layoutById('two'), D);
    const t = two.els.filter((e): e is TextEl => e.kind === 'text');
    expect(t).toHaveLength(3);
    expect(textOf(t.find((e) => e.role === 'title')!)).toBe('Plan');
    expect(textOf(t.find((e) => e.role === 'body')!)).toBe('One\nTwo');
    expect(textOf(t.find((e) => e.role === 'body2')!)).toBe('');
    // a layout without a place for the body keeps its text on the slide
    const only = applyLayout(filled, layoutById('title-only'), D);
    expect(only.els.map((e) => (e as TextEl).role)).toEqual(['title', 'body']); // the old body box stays, with its role, so a later layout can take it back
    expect(textOf(only.els[1] as TextEl)).toBe('One\nTwo');
    // shapes and pictures are left alone
    const withShape = { ...filled, els: [...filled.els, textBox({ x: 10, y: 10, w: 100, h: 100 }, [], { geometry: 'ellipse' as const, fill: '#ff0000' })] };
    expect(applyLayout(withShape, layoutById('blank'), D).els.some((e) => e.kind === 'text' && e.fill === '#ff0000')).toBe(true);
  });
});

describe('tables', () => {
  it('add and remove rows and columns and keep the frame in step', () => {
    let t = newTable({ x: 100, y: 100, w: 600 }, 2, 3);
    expect([t.w, t.h, t.cells.length, t.cells[0].length]).toEqual([600, 96, 2, 3]);
    t = insertRow(t, 1); t = insertCol(t, 0);
    expect([t.rows.length, t.cols.length, t.cells.length, t.cells[2].length, t.h, t.w]).toEqual([3, 4, 3, 4, 144, 800]);
    t = deleteCol(deleteRow(t, 0), 3);
    expect([t.rows.length, t.cols.length]).toEqual([2, 3]);
    expect(deleteRow(newTable({ x: 0, y: 0, w: 100 }, 1, 1), 0).rows).toHaveLength(1);
    const big = resizeTable(t, t.w * 2, t.h);
    expect(big.w).toBeCloseTo(t.w * 2, -1);
    expect(setCell(t, 0, 0, { t: 'x', b: true }).cells[0][0]).toEqual({ t: 'x', b: true });
    expect(setCell(setCell(t, 0, 0, { b: true }), 0, 0, { b: false }).cells[0][0]).toEqual({ t: '' });
  });
});

describe('new things survive a save and a reload', () => {
  it('lines, arrows, shapes, tables, rotation, numbering and line spacing', async () => {
    const deck = newDeck();
    const line: LineEl = { id: 'l1', kind: 'line', x: 100, y: 200, w: 300, h: 120, color: '#c80000', width: 4, flipV: true, tail: true };
    const dashed: LineEl = { id: 'l2', kind: 'line', x: 500, y: 200, w: 200, h: 0, color: '#0000ff', width: 2, dash: true, head: true };
    let table = newTable({ x: 100, y: 400, w: 600 }, 2, 2); table = setCell(setCell(table, 0, 0, { t: 'Name' }), 1, 1, { t: 'Zoë ☕', b: true, fill: '#ffff00', align: 'right' });
    const star = textBox({ x: 800, y: 100, w: 200, h: 200 }, [], { geometry: 'star5', fill: '#ffcc00', rot: 30 });
    const arrow = textBox({ x: 800, y: 400, w: 260, h: 130 }, [para('Go', { size: 24 })], { geometry: 'rightArrow', fill: '#1f6f5c' });
    const list = textBox({ x: 60, y: 20, w: 500, h: 150 }, [para('First', { size: 24 }, { num: true, lh: 1.5 }), para('Second', { size: 24 }, { num: true, lh: 1.5 })], { rot: 10 });
    deck.slides[0].els = [line, dashed, table, star, arrow, list];
    const again = (await importPptx(await exportPptx(deck))).deck.slides[0].els;
    const ls = again.filter((e): e is LineEl => e.kind === 'line');
    expect(ls).toHaveLength(2);
    expect(ls[0]).toMatchObject({ color: '#c80000', flipV: true, tail: true }); expect(!!ls[0].head).toBe(false); expect(Math.abs(ls[0].w - 300)).toBeLessThan(1.5); expect(ls[0].width).toBeCloseTo(4, 0);
    expect(ls[1]).toMatchObject({ dash: true, head: true }); expect(!!ls[1].flipV).toBe(false);
    const t = again.find((e): e is TableEl => e.kind === 'table')!;
    expect(t.cells.map((r) => r.map((c) => c.t))).toEqual([['Name', ''], ['', 'Zoë ☕']]);
    expect(t.cells[1][1]).toMatchObject({ b: true, fill: '#ffff00', align: 'right' });
    expect(Math.abs(t.cols[0] - 300)).toBeLessThan(1.5);
    const shapes = again.filter((e): e is TextEl => e.kind === 'text');
    expect(shapes.find((e) => e.geometry === 'star5')).toMatchObject({ fill: '#ffcc00' });
    expect(shapes.find((e) => e.geometry === 'star5')!.rot).toBeCloseTo(30, 0);
    expect(shapes.find((e) => e.geometry === 'rightArrow')!.paras[0].runs[0].text).toBe('Go');
    const l = shapes.find((e) => textOf(e).startsWith('First'))!;
    expect(l.rot).toBeCloseTo(10, 0); expect(l.paras.map((p) => [p.num, p.lh])).toEqual([[true, 1.5], [true, 1.5]]);
  });
});

import { isCovered, mergeNext, mergeOf, unmerge } from '../src/slides/tableOps.ts';
import type { ChartEl, ImageEl } from '../src/slides/model.ts';

describe('merged table cells', () => {
  it('join and split cells and follow inserted and deleted rows and columns', () => {
    let t = newTable({ x: 0, y: 0, w: 300 }, 3, 3);
    t = setCell(setCell(t, 0, 0, { t: 'A' }), 0, 1, { t: 'B' });
    t = mergeNext(t, 0, 0, 'right');
    expect(t.merges).toEqual([{ r: 0, c: 0, rs: 1, cs: 2 }]); expect(t.cells[0][0].t).toBe('A B'); expect(t.cells[0][1].t).toBe('');
    expect([isCovered(t, 0, 1), isCovered(t, 0, 0), mergeOf(t, 0, 1)?.c]).toEqual([true, false, 0]);
    t = mergeNext(t, 0, 0, 'down'); expect(t.merges).toEqual([{ r: 0, c: 0, rs: 2, cs: 2 }]);
    expect(mergeNext(newTable({ x: 0, y: 0, w: 100 }, 1, 1), 0, 0, 'right').merges).toBeUndefined();
    expect(insertCol(t, 1).merges).toEqual([{ r: 0, c: 0, rs: 2, cs: 3 }]); expect(insertCol(t, 2).merges).toEqual([{ r: 0, c: 0, rs: 2, cs: 2 }]);
    expect(insertRow(t, 0).merges).toEqual([{ r: 1, c: 0, rs: 2, cs: 2 }]);
    expect(deleteCol(t, 1).merges).toEqual([{ r: 0, c: 0, rs: 2, cs: 1 }]); expect(deleteRow(deleteRow(t, 0), 0).merges).toBeUndefined();
    expect(unmerge(t, 1, 1).merges).toBeUndefined();
  });
});

describe('transitions, crops, merges and charts survive a save', () => {
  it('in a .pptx', async () => {
    const deck = newDeck();
    const png = 'data:image/png;base64,' + readFileSync(join(import.meta.dirname, 'fixtures', 'pic.png')).toString('base64');
    const img: ImageEl = { id: 'i', kind: 'image', src: png, x: 40, y: 40, w: 300, h: 200, crop: { l: 0.1, t: 0.2, r: 0.3, b: 0 } };
    const plain: ImageEl = { id: 'j', kind: 'image', src: png, x: 400, y: 40, w: 100, h: 100 };
    let tb = newTable({ x: 40, y: 300, w: 600 }, 3, 3); tb = mergeNext(setCell(tb, 0, 0, { t: 'Wide' }), 0, 0, 'right'); tb = mergeNext(tb, 1, 2, 'down');
    const chart: ChartEl = { id: 'c', kind: 'chart', type: 'column', title: 'Sales', cats: ['N', 'S', 'E'], series: [{ name: 'Q1', values: [1, 2, null] }, { name: 'Q2', values: [4, 5, 6] }], x: 700, y: 300, w: 500, h: 350 };
    const pie: ChartEl = { ...chart, id: 'p', type: 'pie', title: '', x: 700, y: 20, w: 300, h: 250 };
    deck.slides[0].els = [img, plain, tb, chart, pie]; deck.slides[0].trans = 'push';
    const second = slideFromLayout(layoutById('blank'), D); second.trans = 'zoom'; deck.slides.push(second, slideFromLayout(layoutById('blank'), D));
    const { deck: again, warnings } = await importPptx(await exportPptx(deck));
    expect(warnings).toEqual([]);
    expect(again.slides.map((s) => s.trans)).toEqual(['push', 'zoom', undefined]);
    const [i1, i2] = again.slides[0].els.filter((e): e is ImageEl => e.kind === 'image');
    expect(i1.crop!.l).toBeCloseTo(0.1, 3); expect(i1.crop!.t).toBeCloseTo(0.2, 3); expect(i1.crop!.r).toBeCloseTo(0.3, 3); expect(i2.crop).toBeUndefined();
    const t = again.slides[0].els.find((e): e is TableEl => e.kind === 'table')!;
    expect(t.merges).toEqual([{ r: 0, c: 0, rs: 1, cs: 2 }, { r: 1, c: 2, rs: 2, cs: 1 }]); expect(t.cells[0][0].t).toBe('Wide');
    const cs = again.slides[0].els.filter((e): e is ChartEl => e.kind === 'chart');
    expect(cs.map((c) => [c.type, c.title, c.cats])).toEqual([['column', 'Sales', ['N', 'S', 'E']], ['pie', '', ['N', 'S', 'E']]]);
    expect(cs[0].series).toEqual([{ name: 'Q1', values: [1, 2, 0] }, { name: 'Q2', values: [4, 5, 6] }]); // the file stores a missing number as 0
    expect(Math.abs(cs[0].w - 500)).toBeLessThan(1.5);
  });
});

describe('reading charts and merged cells written by python-pptx', () => {
  it('shows column and pie charts with their numbers, names the radar chart it cannot show, keeps the merge', async () => {
    const { deck, warnings } = await importPptx(fixture('python-pptx-chart.pptx'));
    expect(warnings).toEqual(['A radar chart is not shown (only column, bar, line, area and pie charts are).']);
    const cs = deck.slides[0].els.filter((e): e is ChartEl => e.kind === 'chart');
    expect(cs.map((c) => [c.type, c.title, c.cats])).toEqual([['column', 'Revenue', ['Q1', 'Q2', 'Q3']], ['pie', '', ['A', 'B']]]);
    expect(cs[0].series).toEqual([{ name: 'Sales', values: [19.2, 21.4, 16.7] }, { name: 'Costs', values: [10, 12, 9] }]);
    expect(Math.round(cs[0].w)).toBe(576);
    const t = deck.slides[0].els.find((e): e is TableEl => e.kind === 'table')!;
    expect(t.merges).toEqual([{ r: 0, c: 0, rs: 1, cs: 2 }]); expect(t.cells[0][0].t).toBe('Merged');
  });
});
