/**
 * A presentation in memory. Everything is in px at 96 dpi (a 16:9 slide is 1280 x 720, a 4:3 one 960 x 720), font sizes in pt. A slide is a list of elements:
 * text boxes (which are also the shapes: a rectangle or ellipse is a text box with a fill) and pictures. Edits replace the deck, never change it in place.
 */
export interface Run { text: string; b?: boolean; i?: boolean; u?: boolean; size?: number; color?: string; font?: string }
/** `num` makes the paragraph a numbered list item (numbers count up through neighbouring numbered paragraphs); `lh` is the line spacing as a multiple of the font */
export interface Para { runs: Run[]; align?: 'left' | 'center' | 'right' | 'justify'; bullet?: boolean; num?: boolean; level?: number; lh?: number }
export interface Frame { x: number; y: number; w: number; h: number }
export type Geometry = 'rect' | 'ellipse' | 'roundRect' | 'triangle' | 'diamond' | 'hexagon' | 'star5' | 'rightArrow' | 'leftArrow';
/** `role` says what a text box is for on a layout (the title, the body ...), so changing the layout can move the right text into the right place; `ph` is the hint shown in an empty box while editing (never drawn in the show or saved) */
export type Role = 'title' | 'subtitle' | 'body' | 'body2' | 'head1' | 'head2';
export interface TextEl extends Frame { id: string; kind: 'text'; paras: Para[]; geometry?: Geometry; fill?: string; line?: string; lineW?: number; valign?: 'top' | 'middle' | 'bottom'; rot?: number; role?: Role; ph?: string }
/** the part of a picture cut off each side, as fractions of its size */
export interface Crop { l: number; t: number; r: number; b: number }
export interface ImageEl extends Frame { id: string; kind: 'image'; src: string; alt?: string; rot?: number; crop?: Crop }
/** a straight line from the top-left corner of its frame to the bottom-right one (`flipV` makes it bottom-left to top-right) */
export interface LineEl extends Frame { id: string; kind: 'line'; color: string; width: number; dash?: boolean; flipV?: boolean; head?: boolean; tail?: boolean; rot?: number }
export interface TCell { t: string; b?: boolean; i?: boolean; color?: string; fill?: string; align?: 'left' | 'center' | 'right'; size?: number }
/** a table: column widths and row heights in px (they always add up to the frame), the first row can be a header */
export interface TMerge { r: number; c: number; rs: number; cs: number }
export interface TableEl extends Frame { id: string; kind: 'table'; cols: number[]; rows: number[]; cells: TCell[][]; header: boolean; banded: boolean; accent: string; border: string; rot?: number; /** merged cells: the one at (r, c) spans `rs` rows and `cs` columns, those it covers are hidden */ merges?: TMerge[] }
export type SlideChartType = 'column' | 'bar' | 'line' | 'area' | 'pie';
/** a chart on a slide, with its own little table of numbers (the first series names, the categories down the side) */
export interface ChartEl extends Frame { id: string; kind: 'chart'; type: SlideChartType; title: string; cats: string[]; series: { name: string; values: (number | null)[] }[]; rot?: number }
export type El = TextEl | ImageEl | LineEl | TableEl | ChartEl;
export type Transition = 'fade' | 'push' | 'wipe' | 'zoom';
export interface Slide { id: string; bg?: string; els: El[]; notes: string; /** how the show comes to this slide */ trans?: Transition }
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


export const cloneSlide = (s: Slide): Slide => ({ ...JSON.parse(JSON.stringify(s)) as Slide, id: uid('s'), els: (JSON.parse(JSON.stringify(s.els)) as El[]).map((e) => ({ ...e, id: uid() })) });
/** the box a turned element covers on the slide (what aligning, snapping and the selection rectangle work with) */
export const bounds = (e: Frame & { rot?: number }): Frame => {
  if (!e.rot) return { x: e.x, y: e.y, w: e.w, h: e.h };
  const a = (e.rot * Math.PI) / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  const w = e.w * c + e.h * s, h = e.w * s + e.h * c;
  return { x: e.x + e.w / 2 - w / 2, y: e.y + e.h / 2 - h / 2, w, h };
};
/** keep a frame at least partly inside the slide and a usable size (a line may be flat) */
export const clampFrame = (f: Frame, d: { w: number; h: number }, flat = false): Frame => {
  const w = Math.max(flat ? 0 : 24, Math.min(d.w * 2, f.w)), h = Math.max(flat ? 0 : 16, Math.min(d.h * 2, f.h));
  return { w, h, x: Math.min(d.w - 20, Math.max(20 - w, f.x)), y: Math.min(d.h - 20, Math.max(20 - h, f.y)) };
};

/** the colour text has when a run names none: black on a light slide, white on a dark one */
export function defaultTextColor(bg: string | undefined): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(bg ?? '#ffffff');
  const n = m ? parseInt(m[1], 16) : 0xffffff;
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.5 ? '#000000' : '#ffffff';
}
