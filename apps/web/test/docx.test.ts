import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getSchema } from '@tiptap/core';
import { Node } from '@tiptap/pm/model';
import { editorExtensions } from '../src/editor/extensions.ts';
import { importDocx, type Json } from '../src/editor/docxImport.ts';
import { exportDocx } from '../src/editor/docxExport.ts';

const schema = getSchema(editorExtensions);
const fixture = (n: string) => new Uint8Array(readFileSync(join(import.meta.dirname, 'fixtures', n)));
const valid = (doc: Json) => Node.fromJSON(schema, doc).check();
const find = (n: Json, type: string): Json[] => [...(n.type === type ? [n] : []), ...(n.content ?? []).flatMap((c) => find(c, type))];
const text = (n: Json): string => (n.type === 'text' ? n.text ?? '' : (n.content ?? []).map(text).join(n.type === 'paragraph' || n.type === 'heading' ? '' : ' '));
/** what must survive a round trip: structure and text, with the attributes that matter, not file-specific details */
const shape = (n: Json): unknown => ({
  t: n.type, ...(n.type === 'text' ? { s: n.text, m: (n.marks ?? []).map((m) => m.type + JSON.stringify(m.attrs ?? {})).sort() } : {}),
  ...(n.attrs ? { a: Object.fromEntries(Object.entries(n.attrs).filter(([k, v]) => v != null && v !== false && !['src', 'colwidth', 'alt', 'height', 'start'].includes(k) && !(k === 'colspan' && v === 1) && !(k === 'rowspan' && v === 1))) } : {}),
  ...(n.content ? { c: n.content.map(shape) } : {}),
});
/** adjacent text with identical marks is one run to the reader */
const merge = (n: Json): Json => {
  if (!n.content) return n;
  const out: Json[] = [];
  for (const c of n.content.map(merge)) {
    const p = out[out.length - 1];
    if (c.type === 'text' && p?.type === 'text' && JSON.stringify(p.marks ?? []) === JSON.stringify(c.marks ?? [])) p.text += c.text; else out.push({ ...c });
  }
  return { ...n, content: out };
};

describe('importing a file written by python-docx', () => {
  it('reads headings, formatting, a list, a table and a picture, and the result fits the editor schema', async () => {
    const { doc, warnings } = await importDocx(fixture('python-docx-report.docx'));
    expect(() => valid(doc)).not.toThrow();
    expect(warnings).toEqual([]);
    expect(find(doc, 'heading').map((h) => [h.attrs?.level, text(h)])).toEqual([[1, 'A list'], [1, 'A table']]);
    expect(find(doc, 'paragraph').some((p) => p.attrs?.pstyle === 'title' && text(p) === 'Quarterly report')).toBe(true);
    const bold = find(doc, 'text').find((t) => t.text === 'bold');
    expect(bold?.marks?.map((m) => m.type)).toContain('bold');
    const red = find(doc, 'text').find((t) => t.text === 'red coloured');
    expect(red?.marks?.find((m) => m.type === 'textStyle')?.attrs?.color).toBe('#c80000');
    expect(find(doc, 'bulletList')[0].content).toHaveLength(3);
    expect(find(doc, 'tableRow')).toHaveLength(3);
    const img = find(doc, 'image')[0];
    expect(String(img.attrs?.src)).toMatch(/^data:image\/png;base64,/);
    expect(img.attrs?.width).toBe(192); // 2 inches at 96 dpi
  });
});

describe('importing a file saved by LibreOffice', () => {
  it('reads merged cells, numbered and nested lists, highlight, alignment, font and size', async () => {
    const { doc, warnings } = await importDocx(fixture('libreoffice-roundtrip.docx'));
    expect(() => valid(doc)).not.toThrow();
    expect(warnings).toEqual([]);
    const cells = find(doc, 'tableCell');
    expect(cells.some((c) => c.attrs?.colspan === 2 && text(c) === 'merged across')).toBe(true);
    expect(cells.some((c) => c.attrs?.rowspan === 2 && text(c) === 'merged down')).toBe(true);
    expect(find(doc, 'orderedList')[0].content).toHaveLength(2);
    const nested = find(doc, 'bulletList').find((l) => find(l, 'paragraph').some((p) => text(p) === 'nested bullet'));
    expect(nested).toBeTruthy();
    expect(find(doc, 'text').find((t) => t.text === 'highlighted')?.marks?.some((m) => m.type === 'highlight')).toBe(true);
    expect(find(doc, 'paragraph').some((p) => p.attrs?.textAlign === 'center' && text(p) === 'Centred paragraph')).toBe(true);
    const sized = find(doc, 'text').find((t) => t.text === 'Sized 18pt Georgia');
    const ts = sized?.marks?.find((m) => m.type === 'textStyle')?.attrs;
    expect(ts?.fontSize).toBe('18pt');
    expect(ts?.fontFamily).toBe('Georgia');
  });
});

describe('saving', () => {
  for (const name of ['python-docx-report.docx', 'libreoffice-roundtrip.docx']) {
    it(`${name}: what is read back after a save equals what was saved`, async () => {
      const first = (await importDocx(fixture(name))).doc;
      const { bytes, warnings } = await exportDocx(first);
      expect(warnings).toEqual([]);
      expect(bytes.length).toBeGreaterThan(1000);
      const again = (await importDocx(bytes)).doc;
      expect(() => valid(again)).not.toThrow();
      expect(shape(merge(again))).toEqual(shape(merge(first)));
    });
  }
  it('says what it could not keep', async () => {
    const { warnings } = await exportDocx({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'image', attrs: { src: 'data:image/svg+xml;base64,AAAA' } }] }] });
    expect(warnings.join(' ')).toMatch(/SVG/);
  });
});

// External check: EXPORT_DIR=/some/dir pnpm vitest run  writes the saved files so other programs (python-docx, LibreOffice) can open them.
describe.runIf(process.env.EXPORT_DIR)('external check', () => {
  it('writes the exports', async () => {
    const { writeFileSync } = await import('node:fs');
    for (const name of ['python-docx-report.docx', 'libreoffice-roundtrip.docx']) {
      const { bytes } = await exportDocx((await importDocx(fixture(name))).doc);
      writeFileSync(join(process.env.EXPORT_DIR!, `saved-${name}`), bytes);
    }
  });
});
