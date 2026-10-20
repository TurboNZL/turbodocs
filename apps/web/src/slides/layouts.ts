import { SLIDE_16x9, textBox, uid, type Deck, type Role, type Slide, type TextEl } from './model.ts';

/**
 * Slide layouts: a layout is a list of placeholder text boxes (frames as fractions of the slide, so any slide size works). A box with no text shows its hint while
 * editing and is left out of the show and of the saved file, like an empty placeholder in PowerPoint or Google Slides. Applying a layout to a slide moves the existing
 * text into the matching boxes (by role, then by order) and leaves everything else (pictures, shapes, tables) where it is.
 */
interface Slot { role: Role; x: number; y: number; w: number; h: number; size: number; b?: boolean; align?: 'left' | 'center' | 'right'; bullet?: boolean; valign?: 'top' | 'middle' | 'bottom'; ph: string; color?: string }
export interface Layout { id: string; label: string; slots: Slot[] }
const MUTED = '#6b6f76';
const TITLE: Slot = { role: 'title', x: 0.06, y: 0.06, w: 0.88, h: 0.16, size: 36, b: true, valign: 'middle', ph: 'Click to add a title' };

export const LAYOUTS: Layout[] = [
  { id: 'title', label: 'Title slide', slots: [
    { role: 'title', x: 0.1, y: 0.3, w: 0.8, h: 0.2, size: 44, b: true, align: 'center', valign: 'middle', ph: 'Click to add a title' },
    { role: 'subtitle', x: 0.15, y: 0.54, w: 0.7, h: 0.14, size: 24, align: 'center', color: MUTED, ph: 'Click to add a subtitle' },
  ] },
  { id: 'content', label: 'Title and content', slots: [TITLE, { role: 'body', x: 0.06, y: 0.27, w: 0.88, h: 0.63, size: 24, bullet: true, ph: 'Click to add text' }] },
  { id: 'section', label: 'Section header', slots: [
    { role: 'title', x: 0.08, y: 0.36, w: 0.84, h: 0.2, size: 48, b: true, valign: 'bottom', ph: 'Click to add a section title' },
    { role: 'subtitle', x: 0.08, y: 0.6, w: 0.84, h: 0.12, size: 24, color: MUTED, ph: 'Click to add a description' },
  ] },
  { id: 'two', label: 'Two columns', slots: [
    TITLE,
    { role: 'body', x: 0.06, y: 0.27, w: 0.42, h: 0.63, size: 22, bullet: true, ph: 'Click to add text' },
    { role: 'body2', x: 0.52, y: 0.27, w: 0.42, h: 0.63, size: 22, bullet: true, ph: 'Click to add text' },
  ] },
  { id: 'compare', label: 'Comparison', slots: [
    TITLE,
    { role: 'head1', x: 0.06, y: 0.26, w: 0.42, h: 0.1, size: 24, b: true, valign: 'middle', ph: 'First heading' },
    { role: 'body', x: 0.06, y: 0.37, w: 0.42, h: 0.53, size: 20, bullet: true, ph: 'Click to add text' },
    { role: 'head2', x: 0.52, y: 0.26, w: 0.42, h: 0.1, size: 24, b: true, valign: 'middle', ph: 'Second heading' },
    { role: 'body2', x: 0.52, y: 0.37, w: 0.42, h: 0.53, size: 20, bullet: true, ph: 'Click to add text' },
  ] },
  { id: 'caption', label: 'Caption and content', slots: [
    { role: 'title', x: 0.06, y: 0.08, w: 0.3, h: 0.2, size: 30, b: true, valign: 'bottom', ph: 'Click to add a title' },
    { role: 'subtitle', x: 0.06, y: 0.3, w: 0.3, h: 0.5, size: 18, color: MUTED, ph: 'Click to add a caption' },
    { role: 'body', x: 0.4, y: 0.08, w: 0.54, h: 0.82, size: 24, bullet: true, ph: 'Click to add text' },
  ] },
  { id: 'title-only', label: 'Title only', slots: [TITLE] },
  { id: 'statement', label: 'Big statement', slots: [{ role: 'title', x: 0.1, y: 0.2, w: 0.8, h: 0.6, size: 54, b: true, align: 'center', valign: 'middle', ph: 'Click to add a statement' }] },
  { id: 'blank', label: 'Blank', slots: [] },
];
export const layoutById = (id: string): Layout => LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[1];

const boxOf = (s: Slot, d: { w: number; h: number }, id?: string): TextEl => {
  const t = textBox({ x: Math.round(s.x * d.w), y: Math.round(s.y * d.h), w: Math.round(s.w * d.w), h: Math.round(s.h * d.h) },
    [{ runs: [{ text: '', size: s.size, ...(s.b ? { b: true } : {}), ...(s.color ? { color: s.color } : {}) }], ...(s.align ? { align: s.align } : {}), ...(s.bullet ? { bullet: true } : {}) }],
    { role: s.role, ph: s.ph, ...(s.valign ? { valign: s.valign } : {}) });
  return id ? { ...t, id } : t;
};
export const slideFromLayout = (l: Layout, d: { w: number; h: number }): Slide => ({ id: uid('s'), notes: '', els: l.slots.map((s) => boxOf(s, d)) });
export const newDeck = (): Deck => ({ ...SLIDE_16x9, font: 'Calibri', slides: [slideFromLayout(layoutById('title'), SLIDE_16x9)] });

const hasText = (e: TextEl) => e.paras.some((p) => p.runs.some((r) => r.text !== ''));
/** a plain text box the user placed (no fill, outline or shape): the only kind a layout takes over */
const isFree = (e: TextEl) => !e.fill && !e.line && !e.geometry;

/** The slide with another layout: text boxes go to the layout's boxes (same role first, then in reading order), the box keeps its text and takes the layout's place, size and look. */
export function applyLayout(slide: Slide, l: Layout, d: { w: number; h: number }): Slide {
  const texts = slide.els.filter((e): e is TextEl => e.kind === 'text' && isFree(e) && (hasText(e) || !!e.role));
  const left = new Set(texts.map((e) => e.id));
  const taken = new Map<number, TextEl>();
  l.slots.forEach((s, i) => { const m = texts.find((e) => left.has(e.id) && e.role === s.role); if (m) { taken.set(i, m); left.delete(m.id); } });
  const rest = texts.filter((e) => left.has(e.id) && hasText(e));
  l.slots.forEach((_, i) => { if (!taken.has(i) && rest.length) taken.set(i, rest.shift()!); });
  const placed = new Set<string>();
  const out: TextEl[] = l.slots.map((s, i) => {
    const old = taken.get(i);
    const fresh = boxOf(s, d, old?.id);
    if (!old || !hasText(old)) return fresh;
    placed.add(old.id);
    // keep the words and their emphasis, take the layout's size, alignment, bullets and position
    const paras = old.paras.map((p) => ({ ...p, ...(s.align ? { align: s.align } : { align: undefined }), bullet: s.bullet || undefined, num: s.bullet ? undefined : p.num, runs: p.runs.map((r) => ({ ...r, size: s.size })) }));
    return { ...fresh, paras: paras.map((p) => JSON.parse(JSON.stringify(p)) as typeof p) };
  });
  // text the layout has no box for stays on the slide
  const kept = slide.els.filter((e) => !(e.kind === 'text' && (placed.has(e.id) || (isFree(e) && !hasText(e) && e.role))));
  return { ...slide, els: [...out, ...kept] };
}
