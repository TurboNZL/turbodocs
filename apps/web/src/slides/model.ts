/**
 * A presentation in memory. Everything is in px at 96 dpi (a 16:9 slide is 1280 x 720, a 4:3 one 960 x 720), font sizes in pt. A slide is a list of elements:
 * text boxes (which are also the shapes: a rectangle or ellipse is a text box with a fill) and pictures. Edits replace the deck, never change it in place.
 */
export interface Run { text: string; b?: boolean; i?: boolean; u?: boolean; size?: number; color?: string; font?: string }
export interface Para { runs: Run[]; align?: 'left' | 'center' | 'right' | 'justify'; bullet?: boolean; level?: number }
export interface Frame { x: number; y: number; w: number; h: number }
export type Geometry = 'rect' | 'ellipse' | 'roundRect';
export interface TextEl extends Frame { id: string; kind: 'text'; paras: Para[]; geometry?: Geometry; fill?: string; line?: string; lineW?: number; valign?: 'top' | 'middle' | 'bottom' }
export interface ImageEl extends Frame { id: string; kind: 'image'; src: string; alt?: string }
export type El = TextEl | ImageEl;
export interface Slide { id: string; bg?: string; els: El[]; notes: string }
export interface Deck { w: number; h: number; /** the default text font */ font: string; slides: Slide[] }

let counter = 0;
export const uid = (p = 'e') => `${p}${Date.now().toString(36)}${(counter++).toString(36)}`;
export const SLIDE_16x9 = { w: 1280, h: 720 };
export const DEFAULT_SIZE = 18;
export const pxOfPt = (pt: number) => (pt * 96) / 72;

export const textOf = (e: TextEl): string => e.paras.map((p) => p.runs.map((r) => r.text).join('')).join('\n');
export const para = (text: string, run: Omit<Run, 'text'> = {}, rest: Omit<Para, 'runs'> = {}): Para => ({ runs: text ? [{ text, ...run }] : [], ...rest });
export const textBox = (f: Frame, paras: Para[], rest: Partial<TextEl> = {}): TextEl => ({ id: uid(), kind: 'text', ...f, paras, ...rest });

export const blankSlide = (): Slide => ({ id: uid('s'), els: [], notes: '' });
export function titleSlide(d: { w: number; h: number }): Slide {
  return { id: uid('s'), notes: '', els: [
    textBox({ x: d.w * 0.1, y: d.h * 0.3, w: d.w * 0.8, h: d.h * 0.2 }, [para('Presentation title', { size: 44, b: true }, { align: 'center' })], { valign: 'middle' }),
    textBox({ x: d.w * 0.15, y: d.h * 0.54, w: d.w * 0.7, h: d.h * 0.14 }, [para('Subtitle', { size: 24, color: '#6b6f76' }, { align: 'center' })], { valign: 'top' }),
  ] };
}
export function contentSlide(d: { w: number; h: number }): Slide {
  return { id: uid('s'), notes: '', els: [
    textBox({ x: d.w * 0.06, y: d.h * 0.06, w: d.w * 0.88, h: d.h * 0.16 }, [para('Slide title', { size: 36, b: true })], { valign: 'middle' }),
    textBox({ x: d.w * 0.06, y: d.h * 0.27, w: d.w * 0.88, h: d.h * 0.63 }, [para('First point', { size: 24 }, { bullet: true }), para('Second point', { size: 24 }, { bullet: true })]),
  ] };
}
export const newDeck = (): Deck => ({ ...SLIDE_16x9, font: 'Calibri', slides: [titleSlide(SLIDE_16x9)] });

export const cloneSlide = (s: Slide): Slide => ({ ...JSON.parse(JSON.stringify(s)) as Slide, id: uid('s'), els: (JSON.parse(JSON.stringify(s.els)) as El[]).map((e) => ({ ...e, id: uid() })) });
/** keep a frame at least partly inside the slide and a usable size */
export const clampFrame = (f: Frame, d: { w: number; h: number }): Frame => {
  const w = Math.max(24, Math.min(d.w * 2, f.w)), h = Math.max(16, Math.min(d.h * 2, f.h));
  return { w, h, x: Math.min(d.w - 20, Math.max(20 - w, f.x)), y: Math.min(d.h - 20, Math.max(20 - h, f.y)) };
};

/** the colour text has when a run names none: black on a light slide, white on a dark one */
export function defaultTextColor(bg: string | undefined): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(bg ?? '#ffffff');
  const n = m ? parseInt(m[1], 16) : 0xffffff;
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.5 ? '#000000' : '#ffffff';
}
