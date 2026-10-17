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
