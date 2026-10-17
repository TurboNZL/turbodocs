import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { getSchema } from '@tiptap/core';
import { Node } from '@tiptap/pm/model';
import { editorExtensions } from '../src/editor/extensions.ts';
import { FACTORY_STYLES, importDocx, type Json } from '../src/editor/docxImport.ts';
import { exportDocx } from '../src/editor/docxExport.ts';
import { toMarkdown } from '../src/editor/toMarkdown.ts';
import { listTabs, nextTabName, tabRange } from '../src/editor/tabs.ts';
import { emojiForCode, searchEmoji } from '../src/editor/emoji.ts';

const schema = getSchema(editorExtensions);
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const find = (n: Json, type: string): Json[] => [...(n.type === type ? [n] : []), ...(n.content ?? []).flatMap((c) => find(c, type))];
const p = (t: string, attrs?: Record<string, unknown>): Json => ({ type: 'paragraph', ...(attrs ? { attrs } : {}), content: [{ type: 'text', text: t }] });

describe('what the Docs parity work adds to the file', () => {
  it('writes a picture crop as Word does and reads it back', async () => {
    const doc: Json = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'image', attrs: { src: PNG, width: 100, height: 50, crop: { l: 0.1, t: 0.2, r: 0.3, b: 0.05 } } }] }] };
    const out = await exportDocx(doc, FACTORY_STYLES);
    const xml = await (await JSZip.loadAsync(out.bytes)).file('word/document.xml')!.async('string');
    expect(xml.match(/<a:srcRect/g)).toHaveLength(1); // one crop element per picture, ours
    const back = await importDocx(out.bytes);
    expect(back.warnings).toEqual([]);
    const img = find(back.doc, 'image')[0];
    expect(img.attrs?.crop).toEqual({ l: 0.1, t: 0.2, r: 0.3, b: 0.05 });
  });
  it('leaves an uncropped picture without a crop', async () => {
    const doc: Json = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'image', attrs: { src: PNG, width: 40, height: 40 } }] }] };
    const back = await importDocx((await exportDocx(doc, FACTORY_STYLES)).bytes);
    expect(find(back.doc, 'image')[0].attrs?.crop ?? null).toBeNull();
  });
  it('keeps document tabs as bookmarks, with their titles', async () => {
    const doc: Json = { type: 'doc', content: [p('First', { tab: 'tdtab_1' }), p('one'), p('Second', { tab: 'tdtab_2' }), p('two')] };
    expect(() => Node.fromJSON(schema, doc).check()).not.toThrow();
    const back = await importDocx((await exportDocx(doc, FACTORY_STYLES)).bytes);
    const marks = find(back.doc, 'paragraph').filter((x) => x.attrs?.tab);
    expect(marks.map((m) => [m.attrs?.tab, m.content?.[0].text])).toEqual([['tdtab_1', 'First'], ['tdtab_2', 'Second']]);
    const tabs = listTabs(Node.fromJSON(schema, back.doc));
    expect(tabs.map((t) => t.title)).toEqual(['First', 'Second']);
    expect(nextTabName(Node.fromJSON(schema, back.doc))).toBe('tdtab_3');
    const r = tabRange(Node.fromJSON(schema, back.doc), 0)!;
    expect(r.from).toBe(0);
  });
  it('keeps the page colour', async () => {
    const back = await importDocx((await exportDocx({ type: 'doc', content: [p('x')] }, { ...FACTORY_STYLES, pageColor: '#fbf3e4' })).bytes);
    expect(back.styles.pageColor).toBe('#fbf3e4');
  });
});

describe('Markdown view', () => {
  it('renders headings, marks, lists, links and tables', () => {
    const md = toMarkdown({ type: 'doc', content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Plan' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'bold', marks: [{ type: 'bold' }] }, { type: 'text', text: ' and ' }, { type: 'text', text: 'site', marks: [{ type: 'link', attrs: { href: 'https://x.test' } }] }] },
      { type: 'bulletList', content: [{ type: 'listItem', content: [p('a')] }, { type: 'listItem', content: [p('b'), { type: 'orderedList', content: [{ type: 'listItem', content: [p('c')] }] }] }] },
      { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableHeader', content: [p('H')] }, { type: 'tableHeader', content: [p('I')] }] }, { type: 'tableRow', content: [{ type: 'tableCell', content: [p('1')] }, { type: 'tableCell', content: [p('2')] }] }] },
    ] });
    expect(md).toBe('## Plan\n\n**bold** and [site](https://x.test)\n\n- a\n- b\n  1. c\n\n| H | I |\n| --- | --- |\n| 1 | 2 |\n');
  });
});

describe('emoji', () => {
  it('finds a shortcode and searches by word', () => {
    expect(emojiForCode('smile')).toBe('😄');
    expect(emojiForCode('nope-not-an-emoji')).toBeUndefined();
    expect(searchEmoji('fire').some((e) => e.char === '🔥')).toBe(true);
  });
});
