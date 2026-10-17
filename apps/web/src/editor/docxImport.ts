import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';

/**
 * .docx -> the editor's document (ProseMirror JSON), read straight from the file's XML so that we decide what is kept and can say what is
 * not. What it understands: paragraph styles Title, Subtitle and Heading 1-3 (4-6 become 3, like the first TurboDocs), bold, italic,
 * underline, strike, text colour, highlight, font and size, links, alignment, line spacing, bulleted and numbered lists with nesting,
 * tables (merged cells, widths, cell colour, nested tables) and pictures. What it cannot represent is collected in `warnings`, and the
 * caller must tell the person before a save would drop it.
 */
export type Json = { type: string; attrs?: Record<string, unknown>; content?: Json[]; text?: string; marks?: { type: string; attrs?: Record<string, unknown> }[] };
export interface Imported { doc: Json; warnings: string[]; styles: DocStyles }

/** One paragraph style: sizes in pt, spacing in px (the first TurboDocs' units). */
export interface StyleDef { size?: number; bold?: boolean; italic?: boolean; color?: string; font?: string; before?: number; after?: number }
/** What a document says about its text: the body font, size, line spacing and the five named styles. */
/** Paper: size and margins in twips (1/1440 inch), as in the file. Not shown in the pageless editor, but kept so a save does not change what prints. */
export interface PageSetup { width: number; height: number; landscape: boolean; top: number; right: number; bottom: number; left: number }
export interface DocStyles { pageColor?: string; page: PageSetup; font: string; size: number; line: number; after: number; title: StyleDef; subtitle: StyleDef; h1: StyleDef; h2: StyleDef; h3: StyleDef }
/** The first TurboDocs' paragraph styles (docs/development/LEGACY_REFERENCE.md): used for new documents and wherever a file is silent. */
export const FACTORY_STYLES: DocStyles = {
  page: { width: 11906, height: 16838, landscape: false, top: 1440, right: 1440, bottom: 1440, left: 1440 }, // A4, 2.54 cm margins
  font: 'Calibri', size: 11, line: 1.18, after: 6,
  title: { size: 28, bold: true, before: 0, after: 8 }, subtitle: { size: 15, italic: true, color: '#808080', before: 0, after: 8 },
  h1: { size: 22, bold: true, before: 18, after: 8 }, h2: { size: 17, bold: true, before: 14, after: 8 }, h3: { size: 14, bold: true, before: 10, after: 8 },
};

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const EMU_PER_PX = 9525;
const TWIP_PER_PX = 15;

const HIGHLIGHT: Record<string, string> = {
  yellow: '#ffff00', green: '#00ff00', cyan: '#00ffff', magenta: '#ff00ff', blue: '#0000ff', red: '#ff0000', darkBlue: '#000080', darkCyan: '#008080',
  darkGreen: '#008000', darkMagenta: '#800080', darkRed: '#800000', darkYellow: '#808000', darkGray: '#808080', lightGray: '#c0c0c0', black: '#000000', white: '#ffffff',
};
const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml' };
const SAFE_LINK = /^(https?:|mailto:|tel:)/i;

type El = Element;
const kids = (e: El | null | undefined, name?: string): El[] => (e ? ([...e.childNodes].filter((c) => c.nodeType === 1) as El[]).filter((c) => !name || c.localName === name) : []);
const kid = (e: El | null | undefined, name: string): El | undefined => kids(e, name)[0];
const wAttr = (e: El | null | undefined, name: string): string | null => (e ? (e.getAttributeNS(W, name) ?? e.getAttribute(`w:${name}`)) : null);
const rAttr = (e: El | null | undefined, name: string): string | null => (e ? (e.getAttributeNS(R, name) ?? e.getAttribute(`r:${name}`)) : null);
const on = (e: El | undefined): boolean => { if (!e) return false; const v = wAttr(e, 'val'); return v === null || !['0', 'false', 'off'].includes(v); };
const descendants = (e: El, local: string): El[] => [...e.getElementsByTagNameNS('*', local)];

interface RunProps { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; color?: string; highlight?: string; size?: string; font?: string }
interface Spacing { before?: number; after?: number; line?: number }
interface StyleInfo { id: string; name: string; basedOn?: string; numId?: string; ilvl?: number; rPr: RunProps; sp: Spacing; isDefault: boolean }

function readRPr(rPr: El | undefined): RunProps {
  const p: RunProps = {};
  if (!rPr) return p;
  const b = kid(rPr, 'b'), i = kid(rPr, 'i'), u = kid(rPr, 'u'), s = kid(rPr, 'strike') ?? kid(rPr, 'dstrike');
  if (b) p.bold = on(b);
  if (i) p.italic = on(i);
  if (u) p.underline = (wAttr(u, 'val') ?? 'single') !== 'none';
  if (s) p.strike = on(s);
  const color = wAttr(kid(rPr, 'color'), 'val');
  if (color && color !== 'auto' && /^[0-9a-f]{6}$/i.test(color)) p.color = `#${color.toLowerCase()}`;
  const hl = wAttr(kid(rPr, 'highlight'), 'val');
  const fill = wAttr(kid(rPr, 'shd'), 'fill');
  if (hl && hl !== 'none' && HIGHLIGHT[hl]) p.highlight = HIGHLIGHT[hl];
  else if (fill && fill !== 'auto' && /^[0-9a-f]{6}$/i.test(fill)) p.highlight = `#${fill.toLowerCase()}`;
  const sz = Number(wAttr(kid(rPr, 'sz'), 'val'));
  if (sz > 0) p.size = `${sz / 2}pt`;
  const fonts = kid(rPr, 'rFonts');
  const font = wAttr(fonts, 'ascii') ?? wAttr(fonts, 'hAnsi');
  if (font) p.font = font;
  return p;
}

/** w:spacing -> px for before/after (twips / 15) and a multiple for an automatic line height */
function readSpacing(pPr: El | undefined): Spacing {
  const sp = kid(pPr, 'spacing');
  const out: Spacing = {};
  const num = (n: string) => { const v = wAttr(sp, n); return v === null || v === '' || Number.isNaN(Number(v)) ? undefined : Number(v); };
  const before = num('before'), after = num('after'), line = num('line');
  if (before !== undefined) out.before = Math.round((before / TWIP_PER_PX) * 10) / 10;
  if (after !== undefined) out.after = Math.round((after / TWIP_PER_PX) * 10) / 10;
  if (line !== undefined && line > 0 && (wAttr(sp, 'lineRule') ?? 'auto') === 'auto') out.line = Math.round((line / 240) * 100) / 100;
  return out;
}

function marksOf(p: RunProps, link?: string): NonNullable<Json['marks']> {
  const m: NonNullable<Json['marks']> = [];
  if (p.bold) m.push({ type: 'bold' });
  if (p.italic) m.push({ type: 'italic' });
  if (p.underline) m.push({ type: 'underline' });
  if (p.strike) m.push({ type: 'strike' });
  if (link) m.push({ type: 'link', attrs: { href: link } });
  const ts: Record<string, string> = {};
  if (p.color) ts.color = p.color;
  if (p.size) ts.fontSize = p.size;
  if (p.font) ts.fontFamily = p.font;
  if (Object.keys(ts).length) m.push({ type: 'textStyle', attrs: ts });
  if (p.highlight) m.push({ type: 'highlight', attrs: { color: p.highlight } });
  return m;
}

/** @xmldom/xmldom rather than the browser's DOMParser: the same, namespace-correct parser in the app and in the tests (happy-dom's is not). */
const parse = (xml: string): Document => {
  const errors: string[] = [];
  const d = new DOMParser({ onError: (_l: string, m: string) => errors.push(m) }).parseFromString(xml, 'text/xml') as unknown as Document;
  if (errors.some((m) => /fatal|error/i.test(m)) && !d.documentElement) throw new Error('The document\'s text could not be read (damaged XML).');
  return d;
};

export async function importDocx(bytes: Uint8Array | ArrayBuffer): Promise<Imported> {
  const zip = await JSZip.loadAsync(bytes);
  const text = async (name: string) => (await zip.file(name)?.async('string')) ?? null;
  const docXml = await text('word/document.xml');
  if (!docXml) throw new Error('This is not a Word document (word/document.xml is missing).');
  const xml = parse(docXml);
  const warnings = new Set<string>();

  // ---- styles
  const styles = new Map<string, StyleInfo>();
  const stylesXml = await text('word/styles.xml');
  let defaultsRPr: RunProps = {}, defaultsSp: Spacing = {}, hasDefaults = false;
  if (stylesXml) {
    const dd = descendants(parse(stylesXml).documentElement, 'docDefaults')[0];
    if (dd) { hasDefaults = true; defaultsRPr = readRPr(kid(kid(dd, 'rPrDefault'), 'rPr')); defaultsSp = readSpacing(kid(kid(dd, 'pPrDefault'), 'pPr')); }
    for (const s of descendants(parse(stylesXml).documentElement, 'style')) {
      const id = wAttr(s, 'styleId');
      if (!id) continue;
      const numPr = kid(kid(s, 'pPr'), 'numPr');
      styles.set(id, {
        id, name: wAttr(kid(s, 'name'), 'val') ?? id, basedOn: wAttr(kid(s, 'basedOn'), 'val') ?? undefined,
        numId: wAttr(kid(numPr, 'numId'), 'val') ?? undefined, ilvl: numPr && kid(numPr, 'ilvl') ? Number(wAttr(kid(numPr, 'ilvl'), 'val')) : undefined,
        rPr: readRPr(kid(s, 'rPr')), sp: readSpacing(kid(s, 'pPr')), isDefault: wAttr(s, 'type') === 'paragraph' && wAttr(s, 'default') === '1',
      });
    }
  }
  const chain = (id: string | undefined): StyleInfo[] => { const out: StyleInfo[] = []; for (let n = 0; id && n < 12; n++) { const s = styles.get(id); if (!s) break; out.push(s); id = s.basedOn; } return out; };
  const paraKind = (id: string | undefined): { kind: 'normal' | 'title' | 'subtitle' | 'heading'; level?: number } => {
    for (const s of chain(id)) {
      const n = s.name.toLowerCase().replace(/\s+/g, ' ');
      if (n === 'title') return { kind: 'title' };
      if (n === 'subtitle') return { kind: 'subtitle' };
      const h = /^heading ?(\d)$/.exec(n) ?? /^heading(\d)$/i.exec(s.id);
      if (h) return { kind: 'heading', level: Math.min(Number(h[1]), 3) };
    }
    return { kind: 'normal' };
  };

  // ---- numbering: which numId/level is a bullet and which is numbered
  const numFmt = new Map<string, string>(); // "numId:ilvl" -> numFmt
  const numXml = await text('word/numbering.xml');
  if (numXml) {
    const nx = parse(numXml).documentElement;
    const abs = new Map<string, Map<number, string>>();
    for (const a of descendants(nx, 'abstractNum')) {
      const levels = new Map<number, string>();
      for (const l of kids(a, 'lvl')) levels.set(Number(wAttr(l, 'ilvl')), wAttr(kid(l, 'numFmt'), 'val') ?? 'decimal');
      abs.set(wAttr(a, 'abstractNumId') ?? '', levels);
    }
    for (const n of kids(nx, 'num')) {
      const levels = abs.get(wAttr(kid(n, 'abstractNumId'), 'val') ?? '');
      for (const [lvl, fmt] of levels ?? []) numFmt.set(`${wAttr(n, 'numId')}:${lvl}`, fmt);
    }
  }

  // ---- relationships: hyperlinks and pictures
  const links = new Map<string, string>();
  const media = new Map<string, string>(); // rId -> data URL
  const relsXml = await text('word/_rels/document.xml.rels');
  if (relsXml) {
    for (const rel of descendants(parse(relsXml).documentElement, 'Relationship')) {
      const id = rel.getAttribute('Id') ?? '', target = rel.getAttribute('Target') ?? '', type = rel.getAttribute('Type') ?? '';
      if (type.endsWith('/hyperlink') && rel.getAttribute('TargetMode') === 'External') links.set(id, target);
      else if (type.endsWith('/image')) {
        const path = target.startsWith('/') ? target.slice(1) : `word/${target}`.replace(/\/\.\//g, '/');
        const ext = path.split('.').pop()?.toLowerCase() ?? '';
        const f = zip.file(path);
        if (f && MIME[ext]) media.set(id, `data:${MIME[ext]};base64,${await f.async('base64')}`);
        else if (f) warnings.add(`A picture in the format .${ext} is not shown (and is dropped on save).`);
      }
    }
  }

  // ---- what we cannot keep
  const body = xml.getElementsByTagNameNS(W, 'body')[0];
  if (!body) throw new Error('The document has no body.');
  const partWithText = async (re: RegExp) => { for (const n of Object.keys(zip.files)) if (re.test(n) && /<w:t[ >]/.test((await zip.file(n)?.async('string')) ?? '')) return true; return false; };
  if (await partWithText(/^word\/(header|footer)\d*\.xml$/)) warnings.add('Headers and footers.');
  const notes = await Promise.all(['word/footnotes.xml', 'word/endnotes.xml'].map(async (n) => (await text(n)) ?? ''));
  if (notes.some((x) => /<w:footnote [^>]*w:id="[1-9]/.test(x) || /<w:endnote [^>]*w:id="[1-9]/.test(x))) warnings.add('Footnotes or endnotes.');
  if (zip.file('word/comments.xml') && /<w:comment /.test((await text('word/comments.xml')) ?? '')) warnings.add('Comments.');
  if (descendants(body, 'del').length) warnings.add('Tracked deletions (the deleted text is dropped; inserted text is kept as normal text).');
  if (descendants(body, 'txbxContent').length) warnings.add('Text boxes.');
  if (descendants(body, 'chart').length) warnings.add('Charts.');
  if (descendants(body, 'oMath').length || descendants(body, 'oMathPara').length) warnings.add('Equations.');
  if (descendants(body, 'pict').length || descendants(body, 'object').length) warnings.add('Embedded objects and legacy drawings.');
  if (descendants(body, 'footnoteReference').length) warnings.add('Footnotes or endnotes.');
  if (descendants(body, 'anchor').some((a) => a.namespaceURI?.includes('wordprocessingDrawing'))) warnings.add('Floating pictures become part of the text flow.');

  // ---- body -> blocks
  const listCounter = new Map<string, number>();

  function runsOf(p: El, inherited: RunProps, link?: string): Json[] {
    const out: Json[] = [];
    for (const c of kids(p)) {
      switch (c.localName) {
        case 'r': out.push(...runContent(c, inherited, link)); break;
        case 'hyperlink': {
          const id = rAttr(c, 'id');
          const href = id ? links.get(id) : undefined;
          out.push(...runsOf(c, inherited, href && SAFE_LINK.test(href) ? href : undefined));
          break;
        }
        case 'ins': case 'smartTag': case 'sdt': case 'fldSimple': case 'customXml':
          out.push(...runsOf(c.localName === 'sdt' ? (kid(c, 'sdtContent') ?? c) : c, inherited, link)); break;
        case 'del': break; // deleted text
        default: break;
      }
    }
    return out;
  }

  function runContent(r: El, inherited: RunProps, link?: string): Json[] {
    const direct = readRPr(kid(r, 'rPr'));
    const rs = wAttr(kid(kid(r, 'rPr'), 'rStyle'), 'val');
    const fromStyle = rs && rs !== 'Hyperlink' ? styles.get(rs)?.rPr ?? {} : {};
    const props: RunProps = { ...inherited, ...fromStyle, ...direct };
    const marks = marksOf(props, link);
    const out: Json[] = [];
    const add = (t: string) => { if (t) out.push({ type: 'text', text: t, ...(marks.length ? { marks } : {}) }); };
    const walk = (parent: El) => {
      for (const c of kids(parent)) {
        switch (c.localName) {
          case 't': add(c.textContent ?? ''); break;
          case 'tab': add('\t'); break;
          case 'noBreakHyphen': add('-'); break;
          case 'br': if ((wAttr(c, 'type') ?? 'textWrapping') === 'textWrapping') out.push({ type: 'hardBreak' }); break;
          case 'cr': out.push({ type: 'hardBreak' }); break;
          case 'drawing': { const img = drawing(c); if (img) out.push(img); break; }
          case 'AlternateContent': { const ch = kid(c, 'Choice') ?? kid(c, 'Fallback'); if (ch) walk(ch); break; }
          default: break;
        }
      }
    };
    walk(r);
    return out;
  }

  function drawing(d: El): Json | null {
    const blip = descendants(d, 'blip')[0];
    const id = blip ? rAttr(blip, 'embed') : null;
    const src = id ? media.get(id) : undefined;
    if (!src) return null;
    const ext = descendants(d, 'extent')[0];
    const cx = Number(ext?.getAttribute('cx')), cy = Number(ext?.getAttribute('cy'));
    const alt = descendants(d, 'docPr')[0]?.getAttribute('descr') ?? null;
    const rect = descendants(d, 'srcRect')[0];
    const part = (k: string) => Math.min(0.95, Math.max(0, (Number(rect?.getAttribute(k)) || 0) / 100000));
    const crop = rect ? { l: part('l'), t: part('t'), r: part('r'), b: part('b') } : null;
    return { type: 'image', attrs: { src, alt, ...(crop && (crop.l || crop.t || crop.r || crop.b) ? { crop } : {}), ...(cx > 0 ? { width: Math.round(cx / EMU_PER_PX) } : {}), ...(cy > 0 ? { height: Math.round(cy / EMU_PER_PX) } : {}) } };
  }

  interface ListItem { level: number; kind: 'bullet' | 'ordered'; numId: string; para: Json }
  type Block = Json | { list: ListItem };

  function paragraph(p: El): Block {
    const pPr = kid(p, 'pPr');
    const styleId = wAttr(kid(pPr, 'pStyle'), 'val') ?? undefined;
    const kind = paraKind(styleId);
    const attrs: Record<string, unknown> = {};
    const jc = wAttr(kid(pPr, 'jc'), 'val');
    if (jc === 'center') attrs.textAlign = 'center';
    else if (jc === 'right' || jc === 'end') attrs.textAlign = 'right';
    else if (jc === 'both' || jc === 'distribute') attrs.textAlign = 'justify';
    const sp = kid(pPr, 'spacing');
    const line = Number(wAttr(sp, 'line'));
    if (line > 0 && (wAttr(sp, 'lineRule') ?? 'auto') === 'auto' && Math.abs(line - 240) > 6) attrs.lineHeight = Math.round((line / 240) * 100) / 100;
    // the paragraph style's own run formatting (a "Quote" style in italics) carries to its runs
    const inherited: RunProps = chain(styleId).reverse().reduce<RunProps>((acc, s) => (kind.kind === 'normal' ? { ...acc, ...s.rPr } : acc), {});
    const content = runsOf(p, inherited);
    const tabMark = descendants(p, 'bookmarkStart').map((b) => wAttr(b, 'name') ?? '').find((n) => /^tdtab_/.test(n));
    if (tabMark) attrs.tab = tabMark;
    let node: Json;
    if (kind.kind === 'heading') node = { type: 'heading', attrs: { level: kind.level, ...attrs }, ...(content.length ? { content } : {}) };
    else node = { type: 'paragraph', attrs: { ...attrs, ...(kind.kind === 'title' || kind.kind === 'subtitle' ? { pstyle: kind.kind } : {}) }, ...(content.length ? { content } : {}) };

    // list membership: the paragraph's own numbering, else its style's
    const numPr = kid(pPr, 'numPr');
    let numId = wAttr(kid(numPr, 'numId'), 'val') ?? undefined;
    let ilvl = numPr && kid(numPr, 'ilvl') ? Number(wAttr(kid(numPr, 'ilvl'), 'val')) : undefined;
    if (!numPr) for (const s of chain(styleId)) if (s.numId) { numId = s.numId; ilvl = s.ilvl; break; }
    if (numId && numId !== '0' && node.type === 'paragraph') {
      const level = ilvl ?? 0;
      const fmt = numFmt.get(`${numId}:${level}`);
      return { list: { level, numId, kind: fmt && fmt !== 'bullet' && fmt !== 'none' ? 'ordered' : 'bullet', para: node } };
    }
    return node;
  }

  /** Consecutive list paragraphs -> nested bulletList / orderedList nodes. */
  function lists(items: ListItem[]): Json[] {
    const out: Json[] = [];
    const stack: { level: number; kind: string; list: Json; last?: Json }[] = [];
    for (const it of items) {
      const level = Math.min(it.level, stack.length ? stack[stack.length - 1].level + 1 : 0);
      while (stack.length && stack[stack.length - 1].level > level) stack.pop();
      let top = stack[stack.length - 1];
      if (top && top.level === level && top.kind !== it.kind) { stack.pop(); top = stack[stack.length - 1]; }
      if (!top || top.level < level) {
        const list: Json = { type: it.kind === 'ordered' ? 'orderedList' : 'bulletList', content: [] };
        if (it.kind === 'ordered' && level === 0) { const start = (listCounter.get(it.numId) ?? 0) + 1; if (start > 1) list.attrs = { start }; }
        if (top?.last) (top.last.content ??= []).push(list); else out.push(list);
        stack.push({ level, kind: it.kind, list });
        top = stack[stack.length - 1];
      }
      const li: Json = { type: 'listItem', content: [it.para] };
      top.list.content!.push(li);
      top.last = li;
      if (level === 0) listCounter.set(it.numId, (listCounter.get(it.numId) ?? 0) + 1);
    }
    return out;
  }

  function table(t: El): Json {
    const grid = kids(kid(t, 'tblGrid'), 'gridCol').map((g) => Math.round(Number(wAttr(g, 'w')) / TWIP_PER_PX) || 0);
    const rows: Json[] = [];
    const open: (Json | null)[] = []; // per grid column: the cell that a vertical merge continues
    for (const tr of kids(t, 'tr')) {
      const cells: Json[] = [];
      let col = 0;
      for (const tc of kids(tr, 'tc')) {
        const pr = kid(tc, 'tcPr');
        const span = Math.max(1, Number(wAttr(kid(pr, 'gridSpan'), 'val')) || 1);
        const vm = kid(pr, 'vMerge');
        if (vm && (wAttr(vm, 'val') ?? 'continue') === 'continue' && open[col]) {
          const origin = open[col]!;
          origin.attrs!.rowspan = (origin.attrs!.rowspan as number) + 1;
          col += span; continue;
        }
        const fill = wAttr(kid(pr, 'shd'), 'fill');
        const widths = grid.slice(col, col + span);
        const cell: Json = {
          type: 'tableCell',
          attrs: {
            colspan: span, rowspan: 1, colwidth: widths.length === span && widths.every((w) => w > 0) ? widths : null,
            ...(fill && fill !== 'auto' && /^[0-9a-f]{6}$/i.test(fill) ? { backgroundColor: `#${fill.toLowerCase()}` } : {}),
          },
          content: blocks(tc),
        };
        for (let i = 0; i < span; i++) open[col + i] = vm ? cell : null;
        cells.push(cell);
        col += span;
      }
      rows.push({ type: 'tableRow', content: cells });
    }
    return { type: 'table', content: rows.filter((r) => r.content!.length) };
  }

  function blocks(container: El): Json[] {
    const out: Json[] = [];
    let pending: ListItem[] = [];
    const flush = () => { if (pending.length) { out.push(...lists(pending)); pending = []; } };
    const visit = (parent: El) => {
      for (const c of kids(parent)) {
        if (c.localName === 'p') { const b = paragraph(c); if ('list' in b) pending.push(b.list); else { flush(); out.push(b); } }
        else if (c.localName === 'tbl') { flush(); out.push(table(c)); }
        else if (c.localName === 'sdt') visit(kid(c, 'sdtContent') ?? c);
      }
    };
    visit(container);
    flush();
    if (!out.length) out.push({ type: 'paragraph' });
    return out;
  }

  const content = blocks(body);
  if (content[content.length - 1].type === 'table') content.push({ type: 'paragraph' });
  return { doc: { type: 'doc', content }, warnings: [...warnings], styles: resolveStyles() };

  /** The file's own text styles (docDefaults, Normal, Title, Subtitle, Heading 1 to 3); what it does not say comes from FACTORY_STYLES. */
  function resolveStyles(): DocStyles {
    const num = (v: string | undefined) => (v ? parseFloat(v) : undefined);
    const merged = (id: string | undefined) => {
      let r: RunProps = { ...defaultsRPr }, sp: Spacing = { ...defaultsSp };
      for (const st of chain(id).reverse()) { r = { ...r, ...st.rPr }; sp = { ...sp, ...st.sp }; }
      return { r, sp };
    };
    const normal = [...styles.values()].find((x) => x.isDefault);
    const base = merged(normal?.id);
    const out: DocStyles = { ...FACTORY_STYLES };
    const sect = kid(body, 'sectPr');
    const sz = kid(sect, 'pgSize') ?? kid(sect, 'pgSz'), mar = kid(sect, 'pgMar');
    const tw = (e: El | undefined, n: string, d: number) => { const v = Number(wAttr(e, n)); return Number.isFinite(v) && v > 0 ? v : d; };
    if (sz) {
      const land = wAttr(sz, 'orient') === 'landscape';
      out.page = {
        width: tw(sz, 'w', FACTORY_STYLES.page.width), height: tw(sz, 'h', FACTORY_STYLES.page.height), landscape: land,
        top: tw(mar, 'top', 1440), right: tw(mar, 'right', 1440), bottom: tw(mar, 'bottom', 1440), left: tw(mar, 'left', 1440),
      };
    }
    const bg = xml.documentElement ? kid(xml.documentElement, 'background') : undefined;
    const bgc = wAttr(bg, 'color');
    if (bgc && /^[0-9a-f]{6}$/i.test(bgc) && bgc.toLowerCase() !== 'ffffff') out.pageColor = `#${bgc.toLowerCase()}`;
    if (hasDefaults) {
      out.font = base.r.font ?? FACTORY_STYLES.font;
      out.size = num(base.r.size) ?? FACTORY_STYLES.size;
      out.line = base.sp.line ?? 1; // a file that says nothing about line spacing means single spacing
      out.after = base.sp.after ?? 0;
    }
    const named: [keyof Pick<DocStyles, 'title' | 'subtitle' | 'h1' | 'h2' | 'h3'>, (n: string) => boolean][] = [
      ['title', (n) => n === 'title'], ['subtitle', (n) => n === 'subtitle'], ['h1', (n) => n === 'heading 1'], ['h2', (n) => n === 'heading 2'], ['h3', (n) => n === 'heading 3'],
    ];
    for (const [key, is] of named) {
      const st = [...styles.values()].find((x) => is(x.name.toLowerCase().replace(/\s+/g, ' ')));
      if (!st) continue;
      const m = merged(st.id);
      out[key] = {
        size: num(m.r.size), bold: !!m.r.bold, italic: !!m.r.italic, color: m.r.color,
        font: m.r.font && m.r.font !== out.font ? m.r.font : undefined, before: m.sp.before ?? 0, after: m.sp.after ?? 0,
      };
    }
    return out;
  }
}
