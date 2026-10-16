import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Color, FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style';
import { fontStack, plainFont } from './fonts.ts';
import { Search } from './search.ts';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';

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
        types: ['paragraph', 'heading'],
        attributes: {
          lineHeight: { default: null, parseHTML: (el) => Number(el.getAttribute('data-lh')) || null, renderHTML: (a) => (a.lineHeight ? { 'data-lh': String(a.lineHeight), style: `line-height:${a.lineHeight}` } : {}) },
        },
      },
    ];
  },
});

/** A table cell can be coloured (Format > Table > Cell colour in the first TurboDocs). */
const cellColour = {
  addAttributes() {
    return {
      ...(this as unknown as { parent?: () => Record<string, unknown> }).parent?.(),
      backgroundColor: { default: null, parseHTML: (el: HTMLElement) => el.style.backgroundColor || null, renderHTML: (a: Record<string, unknown>) => (a.backgroundColor ? { style: `background-color:${a.backgroundColor}` } : {}) },
    };
  },
};

/** Pictures keep their size: `width` and `height` in px. */
const SizedImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: null, parseHTML: (el) => Number(el.getAttribute('width')) || null, renderHTML: (a) => (a.width ? { width: a.width } : {}) },
      height: { default: null, parseHTML: (el) => Number(el.getAttribute('height')) || null, renderHTML: (a) => (a.height ? { height: a.height } : {}) },
    };
  },
});

export const editorExtensions = [
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
  Table.configure({ resizable: true }),
  TableRow, TableHeader.extend(cellColour), TableCell.extend(cellColour),
  ParagraphStyle, Search,
];
