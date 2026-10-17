import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { DEFAULT_SIZE, defaultTextColor, uid, type Deck, type El, type Geometry, type Para, type Run, type Slide, type TextEl } from './model.ts';

/**
 * .pptx -> Deck. Read straight from the file's XML, like the Word and Excel importers: slides in order, text boxes and placeholders with the position, size,
 * font, colour and bullets they get from their layout, master and theme, rectangles and ellipses with fills, pictures, backgrounds and speaker notes. What it
 * cannot keep (tables, charts, diagrams, animations, video, rotation, other shapes) is listed in `warnings` and is not in the file saved from here.
 */
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const EMU = 9525;
type El_ = Element;
const kids = (e: El_ | null | undefined, name?: string): El_[] => (e ? ([...e.childNodes].filter((c) => c.nodeType === 1) as El_[]).filter((c) => !name || c.localName === name) : []);
const kid = (e: El_ | null | undefined, ...path: string[]): El_ | undefined => { let c: El_ | undefined = e ?? undefined; for (const n of path) { c = kids(c, n)[0]; if (!c) return undefined; } return c; };
const desc = (e: El_, name: string): El_[] => [...e.getElementsByTagNameNS('*', name)];
const parse = (s: string) => new DOMParser().parseFromString(s, 'text/xml') as unknown as Document;
const rid = (e: El_) => e.getAttributeNS(R, 'embed') ?? e.getAttribute('r:embed') ?? e.getAttributeNS(R, 'id') ?? e.getAttribute('r:id') ?? '';
const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' };

interface Part { el: El_; rels: Map<string, { type: string; target: string }>; path: string }
interface Theme { colors: Map<string, string>; major: string; minor: string }
interface Props { size?: number; b?: boolean; i?: boolean; u?: boolean; color?: string; font?: string; align?: Para['align']; bullet?: boolean }

const resolvePath = (base: string, target: string): string => {
  if (target.startsWith('/')) return target.slice(1);
  const parts = base.split('/').slice(0, -1);
  for (const seg of target.split('/')) { if (seg === '..') parts.pop(); else if (seg !== '.') parts.push(seg); }
  return parts.join('/');
};
const hex = (c: string): string => `#${c.toLowerCase()}`;
function hsl(hexc: string): [number, number, number] {
  const n = parseInt(hexc.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
  if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
  return [h, s, l];
}
function fromHsl(h: number, s: number, l: number): string {
  const f = (p: number, q: number, t: number) => { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const c = s === 0 ? [l, l, l] : [f(p, q, h + 1 / 3), f(p, q, h), f(p, q, h - 1 / 3)];
  return `#${c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('')}`;
}
/** tint (towards white) and shade (towards black) are done in linear light, as PowerPoint does */
function blendLinear(hexc: string, v: number, tint: boolean): string {
  const n = parseInt(hexc.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => {
    const lin = (x / 255) <= 0.04045 ? x / 255 / 12.92 : ((x / 255 + 0.055) / 1.055) ** 2.4;
    const mixed = tint ? lin * v + (1 - v) : lin * v;
    const srgb = mixed <= 0.0031308 ? mixed * 12.92 : 1.055 * mixed ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, srgb)) * 255).toString(16).padStart(2, '0');
  });
  return `#${ch.join('')}`;
}
const PRESET: Record<string, string> = { black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff', yellow: '#ffff00', gray: '#808080', grey: '#808080', orange: '#ffa500', purple: '#800080' };

export interface ImportedDeck { deck: Deck; warnings: string[] }

export async function importPptx(bytes: Uint8Array): Promise<ImportedDeck> {
  const zip = await JSZip.loadAsync(bytes);
  const warnings = new Set<string>();
  const text = async (p: string) => (await zip.file(p)?.async('string')) ?? null;
  const cache = new Map<string, Part | null>();
  const part = async (path: string): Promise<Part | null> => {
    if (cache.has(path)) return cache.get(path)!;
    const xml = await text(path);
    let out: Part | null = null;
    if (xml) {
      const relsPath = path.replace(/([^/]+)$/, '_rels/$1.rels');
      const rels = new Map<string, { type: string; target: string }>();
      const rx = await text(relsPath);
      if (rx) for (const r of kids(parse(rx).documentElement, 'Relationship')) rels.set(r.getAttribute('Id') ?? '', { type: r.getAttribute('Type') ?? '', target: r.getAttribute('TargetMode') === 'External' ? '' : resolvePath(path, r.getAttribute('Target') ?? '') });
      out = { el: parse(xml).documentElement, rels, path };
    }
    cache.set(path, out);
    return out;
  };
  const pres = await part('ppt/presentation.xml');
  if (!pres) throw new Error('This is not a PowerPoint file (ppt/presentation.xml is missing).');
  const sz = kid(pres.el, 'sldSz');
  const W = Math.round(Number(sz?.getAttribute('cx') ?? 12192000) / EMU), H = Math.round(Number(sz?.getAttribute('cy') ?? 6858000) / EMU);
  const slidePaths = kids(kid(pres.el, 'sldIdLst'), 'sldId').map((s) => pres.rels.get(rid(s))?.target).filter((p): p is string => !!p);

  const themes = new Map<string, Theme>();
  const themeOf = async (master: Part): Promise<Theme> => {
    const tp = [...master.rels.values()].find((r) => r.type.endsWith('/theme'))?.target ?? '';
    if (themes.has(tp)) return themes.get(tp)!;
    const t: Theme = { colors: new Map(), major: 'Calibri', minor: 'Calibri' };
    const tx = await part(tp);
    if (tx) {
      const cs = kid(tx.el, 'themeElements', 'clrScheme');
      for (const c of kids(cs)) { const v = kid(c, 'srgbClr')?.getAttribute('val') ?? kid(c, 'sysClr')?.getAttribute('lastClr'); if (v) t.colors.set(c.localName, hex(v)); }
      const fs = kid(tx.el, 'themeElements', 'fontScheme');
      t.major = kid(fs, 'majorFont', 'latin')?.getAttribute('typeface') ?? t.major; t.minor = kid(fs, 'minorFont', 'latin')?.getAttribute('typeface') ?? t.minor;
    }
    themes.set(tp, t);
    return t;
  };

  interface Ctx { theme: Theme; clrMap: Map<string, string>; master: Part; layout: Part | null }
  const colorIn = (holder: El_ | undefined, ctx: Ctx): string | undefined => {
    const c = kids(holder).find((k) => ['srgbClr', 'schemeClr', 'sysClr', 'prstClr'].includes(k.localName));
    if (!c) return undefined;
    let col: string | undefined;
    if (c.localName === 'srgbClr') col = hex(c.getAttribute('val') ?? '000000');
    else if (c.localName === 'sysClr') col = hex(c.getAttribute('lastClr') ?? (c.getAttribute('val') === 'window' ? 'ffffff' : '000000'));
    else if (c.localName === 'prstClr') col = PRESET[c.getAttribute('val') ?? ''] ?? '#000000';
    else { const n = c.getAttribute('val') ?? 'tx1'; col = ctx.theme.colors.get(ctx.clrMap.get(n) ?? n) ?? (n === 'bg1' ? '#ffffff' : '#000000'); }
    for (const m of kids(c)) {
      const v = Number(m.getAttribute('val')) / 100000;
      if (m.localName === 'lumMod' || m.localName === 'lumOff') { const [h, s, l] = hsl(col); col = fromHsl(h, s, Math.min(1, Math.max(0, m.localName === 'lumMod' ? l * v : l + v))); }
      else if (m.localName === 'tint' || m.localName === 'shade') col = blendLinear(col, v, m.localName === 'tint');
    }
    return col;
  };

  const phOf = (sp: El_) => kid(sp, 'nvSpPr', 'nvPr', 'ph');
  const findPh = (src: Part | null, ph: El_ | undefined): El_ | undefined => {
    if (!src || !ph) return undefined;
    const idx = ph.getAttribute('idx'), type = ph.getAttribute('type') ?? 'body';
    const norm = (t: string) => (t === 'ctrTitle' ? 'title' : t === 'subTitle' || t === 'obj' ? 'body' : t);
    const sps = desc(kid(src.el, 'cSld', 'spTree')!, 'sp').filter((s) => phOf(s));
    return sps.find((s) => idx && phOf(s)!.getAttribute('idx') === idx) ?? sps.find((s) => norm(phOf(s)!.getAttribute('type') ?? 'body') === norm(type));
  };
  const xfrmOf = (sp: El_): { x: number; y: number; w: number; h: number } | undefined => {
    const x = kid(sp, 'spPr', 'xfrm') ?? kid(sp, 'xfrm');
    const off = kid(x, 'off'), ext = kid(x, 'ext');
    return off && ext ? { x: Number(off.getAttribute('x')) / EMU, y: Number(off.getAttribute('y')) / EMU, w: Number(ext.getAttribute('cx')) / EMU, h: Number(ext.getAttribute('cy')) / EMU } : undefined;
  };

  /** the level's run and paragraph defaults, from the first style list that says each thing */
  const levelProps = (lists: (El_ | undefined)[], lvl: number, ctx: Ctx): Props & { bullet?: boolean } => {
    const out: Props = {};
    for (const list of lists) {
      const p = kid(list, `lvl${lvl + 1}pPr`);
      if (!p) continue;
      const d = kid(p, 'defRPr');
      if (out.size === undefined && d?.getAttribute('sz')) out.size = Number(d.getAttribute('sz')) / 100;
      if (out.b === undefined && d?.getAttribute('b')) out.b = d.getAttribute('b') === '1';
      if (out.i === undefined && d?.getAttribute('i')) out.i = d.getAttribute('i') === '1';
      if (out.u === undefined && d?.getAttribute('u')) out.u = d.getAttribute('u') !== 'none';
      if (out.color === undefined) out.color = colorIn(kid(d, 'solidFill'), ctx);
      if (out.font === undefined) { const f = kid(d, 'latin')?.getAttribute('typeface'); if (f) out.font = f; }
      const al = p.getAttribute('algn');
      if (out.align === undefined && al) out.align = al === 'ctr' ? 'center' : al === 'r' ? 'right' : al === 'just' ? 'justify' : 'left';
      if (out.bullet === undefined) { if (kid(p, 'buNone')) out.bullet = false; else if (kid(p, 'buChar') || kid(p, 'buAutoNum')) out.bullet = true; }
    }
    return out;
  };
  const fontName = (f: string | undefined, theme: Theme): string | undefined => (!f ? undefined : f === '+mj-lt' ? theme.major : f === '+mn-lt' ? theme.minor : f.startsWith('+') ? undefined : f);

  const imageOf = async (owner: Part, blipHolder: El_): Promise<string | null> => {
    const id = rid(blipHolder);
    const target = owner.rels.get(id)?.target;
    if (!target) return null;
    const ext = target.split('.').pop()?.toLowerCase() ?? '';
    const f = zip.file(target);
    if (!f) return null;
    if (!MIME[ext]) { warnings.add(`A picture in the format .${ext} is not shown.`); return null; }
    return `data:${MIME[ext]};base64,${await f.async('base64')}`;
  };

  const deck: Deck = { w: W, h: H, font: 'Calibri', slides: [] };
  const defaultTextStyle = kid(pres.el, 'defaultTextStyle');

  for (const sp of slidePaths) {
    const slide = await part(sp);
    if (!slide) continue;
    const layout = await part([...slide.rels.values()].find((r) => r.type.endsWith('/slideLayout'))?.target ?? '');
    const master = layout ? await part([...layout.rels.values()].find((r) => r.type.endsWith('/slideMaster'))?.target ?? '') : null;
    const theme = master ? await themeOf(master) : { colors: new Map(), major: 'Calibri', minor: 'Calibri' };
    if (!deck.slides.length) deck.font = theme.minor;
    const clrMap = new Map<string, string>();
    for (const a of master ? [...(kid(master.el, 'clrMap')?.attributes ?? [])] : []) clrMap.set(a.name, a.value);
    const ctx: Ctx = { theme, clrMap, master: master ?? slide, layout };
    const txStyles = kid(master?.el, 'txStyles');

    const out: Slide = { id: uid('s'), els: [], notes: '' };
    // background: the slide's own, else the layout's, else the master's
    for (const owner of [slide, layout, master]) {
      const bg = kid(owner?.el, 'cSld', 'bg');
      if (!bg) continue;
      const fill = kid(bg, 'bgPr', 'solidFill');
      const ref = kid(bg, 'bgRef');
      out.bg = fill ? colorIn(fill, ctx) : ref ? colorIn(ref, ctx) : undefined;
      if (out.bg || kid(bg, 'bgPr')) break;
    }
    if (kid(slide.el, 'timing') || kid(slide.el, 'transition')) warnings.add('Animations and slide transitions.');

    const place = async (tree: El_, owner: Part, xf: { sx: number; sy: number; dx: number; dy: number }) => {
      for (const node of kids(tree)) {
        const n = node.localName;
        if (n === 'grpSp') {
          const gx = kid(node, 'grpSpPr', 'xfrm');
          const off = kid(gx, 'off'), ext = kid(gx, 'ext'), cho = kid(gx, 'chOff'), che = kid(gx, 'chExt');
          if (!off || !ext || !cho || !che) { await place(node, owner, xf); continue; }
          const sx = Number(ext.getAttribute('cx')) / (Number(che.getAttribute('cx')) || 1), sy = Number(ext.getAttribute('cy')) / (Number(che.getAttribute('cy')) || 1);
          await place(node, owner, { sx: xf.sx * sx, sy: xf.sy * sy, dx: xf.dx + (Number(off.getAttribute('x')) - Number(cho.getAttribute('x')) * sx) * xf.sx, dy: xf.dy + (Number(off.getAttribute('y')) - Number(cho.getAttribute('y')) * sy) * xf.sy });
          continue;
        }
        if (n === 'graphicFrame') { warnings.add('Tables, charts and diagrams are not shown (they are not in the file saved from here).'); continue; }
        if (n === 'cxnSp') { warnings.add('Lines and connectors.'); continue; }
        if (n !== 'sp' && n !== 'pic') continue;
        const ph = n === 'sp' ? phOf(node) : kid(node, 'nvPicPr', 'nvPr', 'ph');
        let f = xfrmOf(node);
        const lph = findPh(layout, ph), mph = findPh(master, ph);
        if (!f) f = (lph ? xfrmOf(lph) : undefined) ?? (mph ? xfrmOf(mph) : undefined);
        else f = { x: (f.x * EMU * xf.sx + xf.dx) / EMU, y: (f.y * EMU * xf.sy + xf.dy) / EMU, w: (f.w * EMU * xf.sx) / EMU, h: (f.h * EMU * xf.sy) / EMU };
        if (!f) continue;
        const rot = Number(kid(node, 'spPr', 'xfrm')?.getAttribute('rot') ?? 0);
        if (rot) warnings.add('Rotated shapes are shown upright.');
        if (n === 'pic') {
          const blip = desc(node, 'blip')[0];
          const src = blip ? await imageOf(owner, blip) : null;
          if (src) {
            const rect = desc(node, 'srcRect')[0];
            if (rect && ['l', 't', 'r', 'b'].some((k) => Number(rect.getAttribute(k)) > 0)) warnings.add('Picture cropping (pictures are shown uncropped).');
            out.els.push({ id: uid(), kind: 'image', src, alt: desc(node, 'cNvPr')[0]?.getAttribute('descr') || undefined, x: f.x, y: f.y, w: f.w, h: f.h });
          }
          continue;
        }
        // ---- a shape or text box
        const spPr = kid(node, 'spPr');
        const prst = kid(spPr, 'prstGeom')?.getAttribute('prst') ?? 'rect';
        const geometry: Geometry | undefined = prst === 'rect' || prst === 'flowChartProcess' ? undefined : prst === 'ellipse' ? 'ellipse' : prst === 'roundRect' ? 'roundRect' : undefined;
        if (!['rect', 'ellipse', 'roundRect', 'flowChartProcess'].includes(prst) && (kid(spPr, 'solidFill') || kid(spPr, 'ln', 'solidFill'))) warnings.add('Some shapes are drawn as plain rectangles.');
        const fill = colorIn(kid(spPr, 'solidFill'), ctx);
        const lnEl = kid(spPr, 'ln');
        const line = lnEl && !kid(lnEl, 'noFill') ? colorIn(kid(lnEl, 'solidFill'), ctx) : undefined;
        const lineW = lnEl?.getAttribute('w') ? Number(lnEl.getAttribute('w')) / EMU : undefined;
        const tb = kid(node, 'txBody');
        const bodyPr = kid(tb, 'bodyPr');
        const anchor = bodyPr?.getAttribute('anchor') ?? kid(lph, 'txBody', 'bodyPr')?.getAttribute('anchor') ?? kid(mph, 'txBody', 'bodyPr')?.getAttribute('anchor');
        const scale = Number(kid(bodyPr, 'normAutofit')?.getAttribute('fontScale') ?? 100000) / 100000;
        const phType = ph?.getAttribute('type');
        const styleKind = phType === 'title' || phType === 'ctrTitle' ? 'titleStyle' : ph ? 'bodyStyle' : 'otherStyle';
        const paras: Para[] = [];
        for (const p of kids(tb, 'p')) {
          const pPr = kid(p, 'pPr');
          const lvl = Number(pPr?.getAttribute('lvl') ?? 0);
          const lists = [kid(tb, 'lstStyle'), kid(lph, 'txBody', 'lstStyle'), kid(mph, 'txBody', 'lstStyle'), kid(txStyles, styleKind), defaultTextStyle];
          const base = levelProps(lists, lvl, ctx);
          const own: Props = {};
          const al = pPr?.getAttribute('algn'); if (al) own.align = al === 'ctr' ? 'center' : al === 'r' ? 'right' : al === 'just' ? 'justify' : 'left';
          if (kid(pPr, 'buNone')) own.bullet = false; else if (kid(pPr, 'buChar') || kid(pPr, 'buAutoNum')) own.bullet = true;
          const runs: Run[] = [];
          for (const rEl of kids(p)) {
            if (rEl.localName === 'br') { runs.push({ text: '\n' }); continue; }
            if (rEl.localName !== 'r' && rEl.localName !== 'fld') continue;
            const t = kid(rEl, 't')?.textContent ?? '';
            if (!t) continue;
            const rp = kid(rEl, 'rPr');
            const size = (rp?.getAttribute('sz') ? Number(rp.getAttribute('sz')) / 100 : base.size ?? DEFAULT_SIZE) * scale;
            const b = rp?.getAttribute('b') ? rp.getAttribute('b') === '1' : base.b;
            const i = rp?.getAttribute('i') ? rp.getAttribute('i') === '1' : base.i;
            const u = rp?.getAttribute('u') ? rp.getAttribute('u') !== 'none' : base.u;
            const color = colorIn(kid(rp, 'solidFill'), ctx) ?? base.color ?? (ctx.theme.colors.get(ctx.clrMap.get('tx1') ?? 'dk1'));
            const font = fontName(kid(rp, 'latin')?.getAttribute('typeface') ?? undefined, theme) ?? fontName(base.font, theme);
            const run: Run = { text: t, size: Math.round(size * 10) / 10 };
            if (b) run.b = true; if (i) run.i = true; if (u) run.u = true;
            if (color && color !== '#000000') run.color = color;
            if (font && font !== theme.minor) run.font = font;
            runs.push(run);
          }
          const bullet = own.bullet ?? base.bullet ?? false;
          const align = own.align ?? base.align;
          // an empty paragraph keeps its size so the line height is right
          if (!runs.length) { const es = kid(p, 'endParaRPr')?.getAttribute('sz'); const sz0 = es ? Number(es) / 100 : base.size; if (sz0) runs.push({ text: '', size: Math.round(sz0 * scale * 10) / 10 }); }
          paras.push({ runs: runs.filter((r) => r.text !== '' || runs.length === 1), ...(align && align !== 'left' ? { align } : {}), ...(bullet ? { bullet: true } : {}), ...(bullet && lvl ? { level: lvl } : {}) });
        }
        while (paras.length && paras[paras.length - 1].runs.every((r) => r.text === '')) paras.pop();
        if (!paras.length && !fill && !line) continue;
        const el: TextEl = { id: uid(), kind: 'text', x: f.x, y: f.y, w: f.w, h: f.h, paras, ...(geometry ? { geometry } : {}), ...(fill ? { fill } : {}), ...(line ? { line } : {}), ...(line && lineW ? { lineW } : {}), ...(anchor === 'ctr' ? { valign: 'middle' as const } : anchor === 'b' ? { valign: 'bottom' as const } : {}) };
        out.els.push(el);
      }
    };
    await place(kid(slide.el, 'cSld', 'spTree')!, slide, { sx: 1, sy: 1, dx: 0, dy: 0 });

    const notesPath = [...slide.rels.values()].find((r) => r.type.endsWith('/notesSlide'))?.target;
    const notes = notesPath ? await part(notesPath) : null;
    if (notes) {
      const body = desc(kid(notes.el, 'cSld', 'spTree')!, 'sp').find((s) => kid(s, 'nvSpPr', 'nvPr', 'ph')?.getAttribute('type') === 'body');
      if (body) out.notes = kids(kid(body, 'txBody'), 'p').map((p) => desc(p, 't').map((t) => t.textContent ?? '').join('')).join('\n').trim();
    }
    if ([...slide.rels.values()].some((r) => /\/(video|audio|media)$/.test(r.type))) warnings.add('Audio and video.');
    deck.slides.push(out);
  }
  if (!deck.slides.length) throw new Error('This presentation has no slides.');
  if (zip.file(/^ppt\/comments\//).length) warnings.add('Comments.');
  return { deck, warnings: [...warnings] };
}

/** the A namespace is unused by name but documents where the elements live */
void A;

/** Deck -> a new .pptx (pptxgenjs, loaded when the first deck is saved). */
export async function exportPptx(deck: Deck): Promise<Uint8Array> {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pres = new PptxGenJS();
  pres.defineLayout({ name: 'TURBODOCS', width: deck.w / 96, height: deck.h / 96 });
  pres.layout = 'TURBODOCS';
  pres.author = 'TurboDocs';
  const inch = (px: number) => px / 96;
  const hexOf = (c: string | undefined) => (c ? c.replace('#', '').toUpperCase() : undefined);
  for (const s of deck.slides) {
    const slide = pres.addSlide();
    if (s.bg) slide.background = { color: hexOf(s.bg)! };
    for (const e of s.els) {
      const pos = { x: inch(e.x), y: inch(e.y), w: inch(e.w), h: inch(e.h) };
      if (e.kind === 'image') { slide.addImage({ data: e.src.replace(/^data:/, ''), ...pos, altText: e.alt ?? undefined }); continue; }
      const shape = e.geometry === 'ellipse' ? pres.ShapeType.ellipse : e.geometry === 'roundRect' ? pres.ShapeType.roundRect : pres.ShapeType.rect;
      const common = { ...pos, ...(e.fill ? { fill: { color: hexOf(e.fill)! } } : {}), ...(e.line ? { line: { color: hexOf(e.line)!, width: ((e.lineW ?? 1) * 72) / 96 } } : {}) };
      const hasText = e.paras.some((p) => p.runs.some((r) => r.text !== ''));
      if (!hasText) { if (e.fill || e.line) slide.addShape(shape, { ...common, ...(e.fill ? {} : { fill: { type: 'none' } }) }); continue; }
      const items = e.paras.flatMap((p, pi) => {
        const runs = p.runs.length ? p.runs : [{ text: '' }];
        return runs.map((r, ri) => ({
          text: r.text.replace(/\n/g, ''),
          options: {
            bold: r.b, italic: r.i, underline: r.u ? { style: 'sng' as const } : undefined, color: hexOf(r.color ?? defaultTextColor(s.bg)), fontSize: r.size ?? DEFAULT_SIZE, fontFace: r.font ?? deck.font,
            ...(ri === 0 ? { align: p.align ?? 'left', ...(p.bullet ? { bullet: true, indentLevel: p.level ?? 0 } : {}) } : {}),
            ...(ri === runs.length - 1 && pi < e.paras.length - 1 ? { breakLine: true } : {}),
          },
        }));
      });
      slide.addText(items as never, { ...common, ...(e.geometry ? { shape } : {}), valign: e.valign ?? 'top', margin: [3.6, 7.2, 3.6, 7.2], fit: 'none', wrap: true, paraSpaceAfter: 0 } as never);
    }
    if (s.notes) slide.addNotes(s.notes);
  }
  const out = (await pres.write({ outputType: 'uint8array' })) as Uint8Array;
  return out;
}
