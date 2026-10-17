import JSZip from 'jszip';
import {
  AlignmentType, BorderStyle, Bookmark, Document, ExternalHyperlink, HeadingLevel, ImageRun, LevelFormat, Packer, Paragraph, ShadingType, Tab, Table, TableCell, TableRow,
  TextRun, UnderlineType, WidthType, type ParagraphChild,
} from 'docx';
import { FACTORY_STYLES, type DocStyles, type Json, type StyleDef } from './docxImport.ts';

/**
 * The editor's document -> a new .docx. The file is written fresh (not patched into the original), with the paragraph styles of the first
 * TurboDocs, or the document's own, when it was imported: the styles come in as `styles` (FACTORY_STYLES for a new document: Title 28 pt, Subtitle 15 pt italic grey, Heading 1-3 at 22/17/14 pt, body 11 pt Calibri, 1.18 line spacing). Anything the
 * editor could not represent was already reported on import; what leaves here is exactly what the editor shows.
 */
export interface Exported { bytes: Uint8Array; warnings: string[] }

const PX = 15; // twips per px
const pt = (n: number) => Math.round(n * 2); // half-points
const hex = (c: unknown): string | undefined => { const m = typeof c === 'string' ? /^#?([0-9a-f]{6})$/i.exec(c.trim()) : null; return m ? m[1].toUpperCase() : undefined; };
const rgbHex = (c: string): string | undefined => {
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(c);
  return m ? [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase() : hex(c);
};
const ALIGN: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED };
const BULLETS = ['•', '◦', '▪'];

function decodeImage(src: string): { type: 'png' | 'jpg' | 'gif' | 'bmp'; data: Uint8Array } | null {
  const m = /^data:image\/(png|jpe?g|gif|bmp);base64,(.+)$/i.exec(src);
  if (!m) return null;
  const bin = atob(m[2]);
  const data = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
  const t = m[1].toLowerCase();
  return { type: t === 'jpeg' || t === 'jpg' ? 'jpg' : (t as 'png' | 'gif' | 'bmp'), data };
}

export async function exportDocx(doc: Json, styles: DocStyles = FACTORY_STYLES): Promise<Exported> {
  const warnings = new Set<string>();
  const orderedRefs: string[] = [];
  const crops: ({ l: number; t: number; r: number; b: number } | null)[] = []; // one per picture, in document order (patched into the XML below)
  let tabNo = 0;

  const runProps = (marks: NonNullable<Json['marks']> | undefined) => {
    const o: Record<string, unknown> = {};
    for (const m of marks ?? []) {
      if (m.type === 'bold') o.bold = true;
      else if (m.type === 'italic') o.italics = true;
      else if (m.type === 'underline') o.underline = { type: UnderlineType.SINGLE };
      else if (m.type === 'strike') o.strike = true;
      else if (m.type === 'textStyle') {
        const a = m.attrs ?? {};
        const c = typeof a.color === 'string' ? rgbHex(a.color) : undefined;
        if (c) o.color = c;
        const size = typeof a.fontSize === 'string' ? /^([\d.]+)pt$/.exec(a.fontSize) : null;
        if (size) o.size = pt(Number(size[1]));
        if (typeof a.fontFamily === 'string' && a.fontFamily) o.font = a.fontFamily.split(',')[0].replace(/["']/g, '').trim();
      } else if (m.type === 'highlight') {
        const c = typeof m.attrs?.color === 'string' ? rgbHex(m.attrs.color) : undefined;
        if (c) o.shading = { type: ShadingType.CLEAR, fill: c, color: 'auto' };
      }
    }
    return o;
  };

  const inline = (nodes: Json[] | undefined): ParagraphChild[] => {
    const out: ParagraphChild[] = [];
    for (const n of nodes ?? []) {
      if (n.type === 'text') {
        const props = runProps(n.marks);
        const link = n.marks?.find((m) => m.type === 'link')?.attrs?.href;
        const parts = (n.text ?? '').split('\t');
        const children: (string | Tab)[] = [];
        parts.forEach((p, i) => { if (i) children.push(new Tab()); if (p) children.push(p); });
        if (!children.length) continue;
        const run = new TextRun({ ...props, children } as never);
        out.push(typeof link === 'string' && link ? new ExternalHyperlink({ link, children: [new TextRun({ ...props, children, color: props.color ?? '0563C1', underline: { type: UnderlineType.SINGLE } } as never)] }) : run);
      } else if (n.type === 'hardBreak') out.push(new TextRun({ break: 1 }));
      else if (n.type === 'image') {
        const img = typeof n.attrs?.src === 'string' ? decodeImage(n.attrs.src) : null;
        if (!img) { warnings.add('A picture in a format Word files cannot hold here (for example SVG) was left out.'); continue; }
        const w = Number(n.attrs?.width) || 240, h = Number(n.attrs?.height) || Math.round(w * 0.6);
        const c = n.attrs?.crop as { l: number; t: number; r: number; b: number } | undefined;
        crops.push(c && (c.l || c.t || c.r || c.b) ? c : null);
        out.push(new ImageRun({ type: img.type, data: img.data, transformation: { width: w, height: h }, altText: { name: 'image', description: String(n.attrs?.alt ?? ''), title: '' } }));
      }
    }
    return out;
  };

  const paraOpts = (n: Json) => {
    const o: Record<string, unknown> = {};
    const a = n.attrs ?? {};
    if (typeof a.textAlign === 'string' && ALIGN[a.textAlign]) o.alignment = ALIGN[a.textAlign];
    if (typeof a.lineHeight === 'number') o.spacing = { line: Math.round(a.lineHeight * 240), lineRule: 'auto' };
    return o;
  };

  const para = (n: Json, extra: Record<string, unknown> = {}): Paragraph => {
    const a = n.attrs ?? {};
    if (n.type === 'heading') {
      const lvl = Math.min(Math.max(Number(a.level) || 1, 1), 3);
      return new Paragraph({ heading: [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][lvl - 1], style: `Heading${lvl}`, ...paraOpts(n), ...extra, children: inline(n.content) });
    }
    if (typeof a.tab === 'string' && a.tab) {
      // a tab of the document: its title line, wrapped in a bookmark Word keeps (and the first TurboDocs used for its tabs)
      const name = /^tdtab_\d+$/.test(a.tab) ? a.tab : `tdtab_${++tabNo}`;
      return new Paragraph({ ...paraOpts(n), ...extra, children: [new Bookmark({ id: name, children: inline(n.content) })] });
    }
    const style = a.pstyle === 'title' ? 'Title' : a.pstyle === 'subtitle' ? 'Subtitle' : undefined;
    return new Paragraph({ ...(style ? { style } : {}), ...paraOpts(n), ...extra, children: inline(n.content) });
  };

  const list = (n: Json, level: number, ref: string): Paragraph[] => {
    const out: Paragraph[] = [];
    for (const li of n.content ?? []) {
      for (const child of li.content ?? []) {
        if (child.type === 'bulletList') out.push(...list(child, level + 1, 'bullets'));
        else if (child.type === 'orderedList') { const r = `ol-${orderedRefs.length}`; orderedRefs.push(r); out.push(...list(child, level + 1, r)); }
        else if (child.type === 'paragraph' || child.type === 'heading') out.push(para(child, { numbering: { reference: ref, level: Math.min(level, 8) } }));
        else out.push(...(block(child) as Paragraph[]).filter((b) => b instanceof Paragraph));
      }
    }
    return out;
  };

  const cellBlocks = (n: Json): (Paragraph | Table)[] => {
    const b = (n.content ?? []).flatMap(block);
    return b.length ? b : [new Paragraph({})];
  };

  const table = (n: Json): Table => {
    const rows = n.content ?? [];
    const cols = Math.max(1, ...rows.map((r) => (r.content ?? []).reduce((s, c) => s + (Number(c.attrs?.colspan) || 1), 0)));
    // column widths from the first row that gives all of them, else equal parts of 600 px
    let widths: number[] = [];
    for (const r of rows) {
      const w = (r.content ?? []).flatMap((c) => { const cw = c.attrs?.colwidth; const span = Number(c.attrs?.colspan) || 1; return Array.isArray(cw) && cw.length === span ? (cw as number[]) : Array(span).fill(0); });
      if (w.length === cols && w.every((x) => x > 0)) { widths = w; break; }
    }
    if (widths.length !== cols) widths = Array(cols).fill(Math.round(600 / cols));
    const border = { style: BorderStyle.SINGLE, size: 4, color: 'auto' };
    return new Table({
      width: { size: widths.reduce((s, x) => s + x, 0) * PX, type: WidthType.DXA },
      columnWidths: widths.map((w) => w * PX),
      borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
      rows: rows.map((r) => new TableRow({
        children: (r.content ?? []).map((c) => {
          const fill = typeof c.attrs?.backgroundColor === 'string' ? rgbHex(c.attrs.backgroundColor) : undefined;
          const span = Number(c.attrs?.colspan) || 1;
          return new TableCell({
            children: cellBlocks(c), columnSpan: span > 1 ? span : undefined, rowSpan: Number(c.attrs?.rowspan) > 1 ? Number(c.attrs?.rowspan) : undefined,
            ...(fill ? { shading: { type: ShadingType.CLEAR, fill, color: 'auto' } } : {}),
          });
        }),
      })),
    });
  };

  function block(n: Json): (Paragraph | Table)[] {
    switch (n.type) {
      case 'paragraph': case 'heading': return [para(n)];
      case 'bulletList': return list(n, 0, 'bullets');
      case 'orderedList': { const r = `ol-${orderedRefs.length}`; orderedRefs.push(r); const start = Number(n.attrs?.start) || 1; if (start > 1) warnings.add('A numbered list that continues from an earlier number restarts at 1.'); return list(n, 0, r); }
      case 'table': return [table(n)];
      case 'blockquote': return (n.content ?? []).flatMap((c) => (c.type === 'paragraph' ? [para(c, { indent: { left: 720 } })] : block(c)));
      case 'horizontalRule': return [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'auto', space: 1 } } })];
      case 'codeBlock': return [new Paragraph({ children: [new TextRun({ text: (n.content ?? []).map((t) => t.text ?? '').join(''), font: 'Courier New' })] })];
      default: warnings.add(`Content of type "${n.type}" was left out.`); return [];
    }
  }

  const children = (doc.content ?? []).flatMap(block);
  if (!children.length || children[children.length - 1] instanceof Table) children.push(new Paragraph({}));

  const numbering = {
    config: [
      { reference: 'bullets', levels: Array.from({ length: 9 }, (_, i) => ({ level: i, format: LevelFormat.BULLET, text: BULLETS[i % 3], alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720 * (i + 1), hanging: 360 } } } })) },
      ...orderedRefs.map((reference) => ({ reference, levels: Array.from({ length: 9 }, (_, i) => ({ level: i, format: i % 3 === 0 ? LevelFormat.DECIMAL : i % 3 === 1 ? LevelFormat.LOWER_LETTER : LevelFormat.LOWER_ROMAN, text: `%${i + 1}.`, alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720 * (i + 1), hanging: 360 } } } })) })),
    ],
  };
  const head = (id: string, name: string, d: StyleDef) => ({
    id, name, basedOn: 'Normal', next: 'Normal', quickFormat: true,
    run: { ...(d.size ? { size: pt(d.size) } : {}), ...(d.bold ? { bold: true } : {}), ...(d.italic ? { italics: true } : {}), ...(hex(d.color) ? { color: hex(d.color) } : {}), ...(d.font ? { font: d.font } : {}) },
    paragraph: { spacing: { before: Math.round((d.before ?? 0) * PX), after: Math.round((d.after ?? 0) * PX) } },
  });
  const document = new Document({
    creator: 'TurboDocs',
    ...(hex(styles.pageColor) ? { background: { color: hex(styles.pageColor) } } : {}),
    styles: {
      default: { document: { run: { font: styles.font, size: pt(styles.size) }, paragraph: { spacing: { after: Math.round(styles.after * PX), line: Math.round(styles.line * 240), lineRule: 'auto' } } } },
      paragraphStyles: [head('Title', 'Title', styles.title), head('Subtitle', 'Subtitle', styles.subtitle), head('Heading1', 'heading 1', styles.h1), head('Heading2', 'heading 2', styles.h2), head('Heading3', 'heading 3', styles.h3)],
    },
    numbering,
    sections: [{
      properties: { page: { size: { width: styles.page.landscape ? styles.page.height : styles.page.width, height: styles.page.landscape ? styles.page.width : styles.page.height, orientation: styles.page.landscape ? 'landscape' : 'portrait' },
        margin: { top: styles.page.top, right: styles.page.right, bottom: styles.page.bottom, left: styles.page.left } } },
      children,
    }],
  } as never);
  const blob = await Packer.toBlob(document);
  const raw = new Uint8Array(await blob.arrayBuffer());
  return { bytes: crops.some(Boolean) ? await patchCrops(raw, crops) : raw, warnings: [...warnings] };
}

/** docx has no crop option for pictures: add `<a:srcRect>` (what Word writes for Crop) after each picture's `<a:blip>`, in document order. */
async function patchCrops(bytes: Uint8Array, crops: ({ l: number; t: number; r: number; b: number } | null)[]): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) return bytes;
  let i = 0;
  const pct = (v: number) => Math.round(Math.min(0.95, Math.max(0, v)) * 100000);
  // docx writes an empty <a:srcRect/> after every picture's blip; ours replaces it (a picture has exactly one)
  const out = xml.replace(/(<pic:blipFill>\s*<a:blip\b[^>]*?(?:\/>|>\s*<\/a:blip>))(\s*<a:srcRect\s*\/>)?/g, (m, blip: string) => {
    const c = crops[i++];
    return c ? `${blip}<a:srcRect l="${pct(c.l)}" t="${pct(c.t)}" r="${pct(c.r)}" b="${pct(c.b)}"/>` : m;
  });
  zip.file('word/document.xml', out);
  return await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
