import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Color, FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style';
import { fontStack, plainFont } from './fonts.ts';
import { Search } from './search.ts';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ImageView } from './ImageView.tsx';
import { DocTabs } from './tabs.ts';
import { Typing, type TypingOptions } from './typing.ts';
import { Table, TableCell, TableHeader, TableRow, TableView } from '@tiptap/extension-table';

/** Title and Subtitle are paragraphs with a `pstyle`; headings are real heading nodes. Line height is per paragraph. */
const ParagraphStyle = Extension.create({
  name: 'paragraphStyle',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          pstyle: { default: null, parseHTML: (el) => el.getAttribute('data-pstyle'), renderHTML: (a) => (a.pstyle ? { 'data-pstyle': a.pstyle, class: `p-${a.pstyle}` } : {}) },
        },
      },
      {
        types: ['paragraph'],
        attributes: {
          tab: { default: null, parseHTML: (el) => el.getAttribute('data-tab'), renderHTML: (a) => (a.tab ? { 'data-tab': a.tab, class: 'p-tab' } : {}) },
        },
      },
      {
        types: ['paragraph', 'heading'],
        attributes: {
          lineHeight: { default: null, parseHTML: (el) => Number(el.getAttribute('data-lh')) || null, renderHTML: (a) => (a.lineHeight ? { 'data-lh': String(a.lineHeight), style: `line-height:${a.lineHeight}` } : {}) },
        },
      },
    ];
  },
});

/** Black or white, whichever reads on a cell fill (any CSS colour the editor stores: #rrggbb or rgb()). */
function inkOn(fill: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(fill.trim());
  const rgb = m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : (fill.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
  if (rgb.length < 3) return 'inherit';
  const lin = rgb.map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2] > 0.4 ? '#111111' : '#f2f2f2';
}

/**
 * A table keeps the proportions of its columns but never grows wider than the text column: a file (Google's pageless export) can say 1470 px while the canvas
 * is 760. The columns are written as percentages of the file's total, so a table narrower than the canvas keeps its own width and a wider one shrinks.
 */
class FitTableView extends TableView {
  constructor(...a: ConstructorParameters<typeof TableView>) { super(...a); this.fit(); }
  update(node: Parameters<TableView['update']>[0]) { const ok = super.update(node); if (ok) this.fit(); return ok; }
  private fit() {
    const cols = [...this.colgroup.children] as HTMLElement[];
    const px = cols.map((c) => parseFloat(c.style.width));
    const total = px.reduce((a, b) => a + b, 0);
    if (!cols.length || px.some((v) => !(v > 0))) return;
    cols.forEach((c, i) => { c.style.width = `${(px[i] / total) * 100}%`; });
    this.table.style.width = `${total}px`; this.table.style.minWidth = ''; this.table.style.maxWidth = '100%';
  }
}

/** A table cell can be coloured (Format > Table > Cell colour in the first TurboDocs). */
const cellColour = {
  addAttributes() {
    return {
      ...(this as unknown as { parent?: () => Record<string, unknown> }).parent?.(),
      // a coloured cell also fixes its own text colour (readable on that fill), or a dark theme's light text lands on a white cell; a run's own colour still wins
      backgroundColor: { default: null, parseHTML: (el: HTMLElement) => el.style.backgroundColor || null, renderHTML: (a: Record<string, unknown>) => (a.backgroundColor ? { style: `background-color:${a.backgroundColor};color:${inkOn(String(a.backgroundColor))}` } : {}) },
    };
  },
};

/** Pictures keep their size (`width`, `height` in px) and a non-destructive `crop` (fractions cut from each side); ImageView draws them. */
const SizedImage = Image.extend({
  addNodeView() { return ReactNodeViewRenderer(ImageView, { as: 'span' } as never); },
  addAttributes() {
    return {
      ...this.parent?.(),
      crop: { default: null, parseHTML: () => null, renderHTML: () => ({}) },
      width: { default: null, parseHTML: (el) => Number(el.getAttribute('width')) || null, renderHTML: (a) => (a.width ? { width: a.width } : {}) },
      height: { default: null, parseHTML: (el) => Number(el.getAttribute('height')) || null, renderHTML: (a) => (a.height ? { height: a.height } : {}) },
    };
  },
});

export const makeExtensions = (typing: TypingOptions) => [
  StarterKit.configure({ heading: { levels: [1, 2, 3] }, code: false, codeBlock: false, link: { openOnClick: false, autolink: false, protocols: ['mailto', 'tel'] } }),
  TextStyle, Color, FontSize,
  FontFamily.extend({
    addGlobalAttributes() {
      return [{ types: ['textStyle'], attributes: { fontFamily: { default: null, parseHTML: (el: HTMLElement) => plainFont(el.style.fontFamily), renderHTML: (a: Record<string, unknown>) => (a.fontFamily ? { style: `font-family: ${fontStack(String(a.fontFamily))}` } : {}) } } }];
    },
  }),
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  SizedImage.configure({ inline: true, allowBase64: true }),
  Table.configure({ resizable: true, View: FitTableView }),
  TableRow, TableHeader.extend(cellColour), TableCell.extend(cellColour),
  ParagraphStyle, Search, DocTabs, Typing.configure(typing),
];

/** the schema every test and tool uses: default typing options */
export const editorExtensions = makeExtensions({ dashes: true, smartQuotes: false, emojiCodes: true, highlightLine: false });
