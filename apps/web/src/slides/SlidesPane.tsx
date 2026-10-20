import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlignCenter, AlignLeft, AlignRight, Baseline, Bold, BringToFront, Circle, Copy, Image as ImageIcon, Italic, LayoutTemplate, List, ListOrdered, Minus, MoveRight, PaintBucket, Palette, Play, Plus, Redo2, RotateCw, SendToBack, Square, Table2, Trash2, Type, Underline, Undo2 } from 'lucide-react';
import { SlideCanvas, SlideStage, type CellRef, type Patch } from './SlideCanvas.tsx';
import { Present } from './Present.tsx';
import { bounds, clampFrame, cloneSlide, DEFAULT_SIZE, para, textBox, uid, type Deck, type El, type Geometry, type ImageEl, type LineEl, type Para, type Run, type Slide, type TableEl, type TCell, type TextEl } from './model.ts';
import { applyLayout, layoutById, LAYOUTS, slideFromLayout, type Layout } from './layouts.ts';
import { GEOMETRY_LABELS } from './shapes.ts';
import { deleteCol, deleteRow, insertCol, insertRow, newTable, resizeTable, setCell } from './tableOps.ts';
import { exportPptx, importPptx } from './pptx.ts';
import { MenuBar, type MenuDef, type MenuItem } from '../components/MenuBar.tsx';
import { Dialog } from '../components/Dialog.tsx';
import { FontBox } from '../components/FontBox.tsx';
import { Btn, Sep, SplitColour } from '../editor/Toolbar.tsx';
import { StatusBar } from '../editor/StatusBar.tsx';
import { DocHeader } from '../editor/DocHeader.tsx';
import { useSaver } from '../editor/useSaver.ts';
import { useAutosave } from '../editor/useAutosave.ts';
import { SIZES } from '../editor/fonts.ts';
import { useHistory } from '../lib/history.ts';
import { usePref } from '../lib/pref.ts';
import { setDirty, confirmLeave } from '../lib/dirty.ts';
import { desktop } from '../lib/settings.ts';
import { docPrefs, rememberLastFile } from '../lib/docPrefs.ts';
import { goHome, goNew, openFileDialog } from '../lib/actions.ts';
import { addOpened, editUrl } from '../lib/opened.ts';
import { useArrivals } from '../lib/arrivals.ts';

const sep: MenuItem = { sep: true };
const BG: [string, string | null][] = [['White', null], ['Warm paper', '#f4f1e8'], ['Light grey', '#e9ecef'], ['Soft blue', '#dbe9f9'], ['Teal', '#1f6f5c'], ['Charcoal', '#26292e'], ['Black', '#000000']];
/** whole-deck looks (the "Design" of Google Slides and PowerPoint): background, text font and the colour of titles */
const DESIGNS: { name: string; bg: string | null; font: string; title?: string }[] = [
  { name: 'Simple light', bg: null, font: 'Calibri' }, { name: 'Paper', bg: '#f4f1e8', font: 'Georgia', title: '#7a2e1d' }, { name: 'Charcoal', bg: '#26292e', font: 'Calibri', title: '#ffd166' },
  { name: 'Teal', bg: '#1f6f5c', font: 'Trebuchet MS', title: '#ffffff' }, { name: 'Ocean', bg: '#0b2545', font: 'Verdana', title: '#8ecae6' }, { name: 'Sky', bg: '#dbe9f9', font: 'Arial', title: '#0b3d91' },
];
const SHAPES: Geometry[] = ['rect', 'roundRect', 'ellipse', 'triangle', 'diamond', 'hexagon', 'star5', 'rightArrow', 'leftArrow'];
const LINE_SPACING: [string, number | undefined][] = [['Single', undefined], ['1.15', 1.15], ['1.5', 1.5], ['Double', 2]];

/**
 * The presentation editor (the Slides app). Slides in a strip on the left, the slide in the middle (move, resize, turn, snap to guides, select several, double-click a
 * text box to type), speaker notes below, Present for the show. Slides come from layouts (title, content, two columns ...), text boxes double as shapes, and there are
 * lines, arrows and tables. Saves a new .pptx.
 */
export function SlidesPane({ initial, path, name, warnings, onReset }: { initial: Deck; path: string | null; name: string; warnings: string[]; onReset: () => void }) {
  const navigate = useNavigate();
  const h = useHistory(initial);
  const deck = h.value;
  const [cur, setCur] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [cell, setCell_] = useState<CellRef | null>(null);
  const [editCell, setEditCell] = useState<CellRef | null>(null);
  const [dirty, setDirtyState] = useState(false);
  const [present, setPresent] = useState<number | null>(null);
  const [picker, setPicker] = useState<'new' | 'apply' | null>(null);
  const [tableDlg, setTableDlg] = useState<{ rows: number; cols: number } | null>(null);
  const [recent, setRecent] = useState<{ path: string; name: string }[]>([]);
  const [zoom, setZoom] = usePref('slides.zoom', 0); // 0 = fit
  const [notesOpen, setNotesOpen] = usePref('slides.notes', 'on');
  const [textColour, setTextColour] = useState('#c80000');
  const [fillColour, setFillColour] = useState('#1f6f5c');
  const [lineColour, setLineColour] = useState('#26292e');
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [fitW, setFitW] = useState({ w: 800, h: 450 });
  const stage = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLDivElement | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const dragFrom = useRef<number | null>(null);
  const touchRef = useRef<() => void>(() => undefined);
  const deckRef = useRef(deck); deckRef.current = deck;
  const clip = useRef<El[]>([]);

  const slide = deck.slides[Math.min(cur, deck.slides.length - 1)];
  const idx = deck.slides.indexOf(slide);
  const sels = slide.els.filter((e) => selected.includes(e.id));
  const el = sels.length === 1 ? sels[0] : null;
  const table = el?.kind === 'table' ? el : null;
  const activeCell = table && cell?.id === table.id ? cell : null;
  const arrived = useArrivals(deck.slides.map((s) => s.id));

  const commit = useCallback((f: (d: Deck) => Deck, record = true) => { h.set(f, record); setDirty(true); setDirtyState(true); touchRef.current(); }, [h]);
  const editSlide = (f: (s: Slide) => Slide, record = true) => commit((d) => ({ ...d, slides: d.slides.map((s, i) => (i === idx ? f(s) : s)) }), record);
  const editEl = (id: string, f: (e: El) => El, record = true) => editSlide((s) => ({ ...s, els: s.els.map((e) => (e.id === id ? f(e) : e)) }), record);
  const editSel = (f: (e: El) => El, record = true) => editSlide((s) => ({ ...s, els: s.els.map((e) => (selected.includes(e.id) ? f(e) : e)) }), record);

  const getBytes = async () => await exportPptx(deckRef.current);
  const saver = useSaver({ path, name, warnings, getBytes });
  const newKey = useRef(`new:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);
  const autosave = useAutosave(saver.path ?? newKey.current, getBytes);
  touchRef.current = autosave.touch;
  const doSave = async (as = false) => { if (await saver.save(as)) { setDirtyState(false); autosave.clear(); } };
  useEffect(() => () => setDirty(false), []);
  useEffect(() => { rememberLastFile(saver.path); }, [saver.path]);
  useEffect(() => { void desktop()?.recent().then((r) => setRecent(r.slice(0, 10).map((x) => ({ path: x.path, name: x.path.split(/[\\/]/).pop() ?? x.path })))); }, []);
  useEffect(() => {
    const e = stage.current; if (!e) return;
    const read = () => setFitW({ w: e.clientWidth - 48, h: e.clientHeight - 48 });
    read(); const ro = new ResizeObserver(read); ro.observe(e); return () => ro.disconnect();
  }, [notesOpen]);
  const scale = zoom > 0 ? zoom / 100 : Math.max(0.1, Math.min(fitW.w / deck.w, fitW.h / deck.h));

  // ---- slides
  const clearSel = () => { setSelected([]); setEditing(null); setCell_(null); setEditCell(null); };
  const go = (i: number) => { if (editing) editRef.current?.blur(); setCur(Math.max(0, Math.min(deck.slides.length - 1, i))); clearSel(); };
  const addSlide = (s: Slide) => { commit((d) => ({ ...d, slides: [...d.slides.slice(0, idx + 1), s, ...d.slides.slice(idx + 1)] })); setCur(idx + 1); clearSel(); };
  const addLayout = (l: Layout) => addSlide(slideFromLayout(l, deck));
  const useLayout = (l: Layout) => { editSlide((s) => applyLayout(s, l, deck)); clearSel(); };
  const dupSlide = () => { commit((d) => ({ ...d, slides: [...d.slides.slice(0, idx + 1), cloneSlide(slide), ...d.slides.slice(idx + 1)] })); setCur(idx + 1); };
  const delSlide = () => { if (deck.slides.length < 2) { editSlide((s) => ({ ...s, els: [], bg: undefined })); return; } commit((d) => ({ ...d, slides: d.slides.filter((_, i) => i !== idx) })); setCur(Math.max(0, idx - 1)); clearSel(); };
  const moveSlide = (from: number, to: number) => { if (from === to || to < 0 || to >= deck.slides.length) return; commit((d) => { const a = [...d.slides]; const [s] = a.splice(from, 1); a.splice(to, 0, s); return { ...d, slides: a }; }); setCur(to); };
  const resizeDeck = (w: number, hh: number) => commit((d) => ({ ...d, w, h: hh, slides: d.slides.map((s) => ({ ...s, els: s.els.map((e) => ({ ...e, x: (e.x * w) / d.w, y: (e.y * hh) / d.h, w: (e.w * w) / d.w, h: (e.h * hh) / d.h })) })) }));
  const applyDesign = (g: (typeof DESIGNS)[number]) => commit((d) => ({
    ...d, font: g.font,
    slides: d.slides.map((s) => ({ ...s, bg: g.bg ?? undefined, els: s.els.map((e) => (e.kind === 'text' && e.role === 'title' ? { ...e, paras: e.paras.map((p) => ({ ...p, runs: p.runs.map((r) => ({ ...r, color: g.title })) })) } : e)) })),
  }));

  // ---- elements
  const addEl = (e: El) => { editSlide((s) => ({ ...s, els: [...s.els, e] })); setSelected([e.id]); setCell_(null); };
  const addText = () => { const b = textBox({ x: deck.w * 0.3, y: deck.h * 0.4, w: deck.w * 0.4, h: 80 }, [para('Text', { size: 24 })]); addEl(b); setTimeout(() => setEditing(b.id), 0); };
  const addShape = (g: Geometry) => {
    const arrow = g === 'rightArrow' || g === 'leftArrow', w = arrow ? 260 : g === 'star5' ? 200 : 240, hh = arrow ? 130 : g === 'star5' ? 200 : g === 'ellipse' ? 160 : 140;
    addEl(textBox({ x: Math.round((deck.w - w) / 2), y: Math.round((deck.h - hh) / 2), w, h: hh }, [], { geometry: g === 'rect' ? undefined : g, fill: fillColour, valign: 'middle' }));
  };
  const addLine = (arrow: boolean) => addEl({ id: uid(), kind: 'line', x: Math.round(deck.w * 0.3), y: Math.round(deck.h * 0.5), w: Math.round(deck.w * 0.4), h: 0, color: lineColour, width: 3, ...(arrow ? { tail: true } : {}) } as LineEl);
  const addTable = (rows: number, cols: number) => { const w = Math.min(deck.w * 0.8, cols * 180); addEl(newTable({ x: Math.round((deck.w - w) / 2), y: Math.round(deck.h * 0.3), w }, rows, cols)); };
  const addImage = (file: File | undefined) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => { const src = String(r.result); const im = new window.Image(); im.onload = () => { const k = Math.min(1, (deck.w * 0.6) / (im.naturalWidth || 1), (deck.h * 0.7) / (im.naturalHeight || 1)); const w = Math.round((im.naturalWidth || 400) * k), hh = Math.round((im.naturalHeight || 300) * k); addEl({ id: uid(), kind: 'image', src, x: Math.round((deck.w - w) / 2), y: Math.round((deck.h - hh) / 2), w, h: hh } as ImageEl); }; im.src = src; };
    r.readAsDataURL(file);
  };
  const delEl = () => { if (sels.length) { editSlide((s) => ({ ...s, els: s.els.filter((e) => !selected.includes(e.id)) })); clearSel(); } };
  const copy = () => { clip.current = JSON.parse(JSON.stringify(sels)) as El[]; };
  const paste = (offset = 20) => {
    if (!clip.current.length) return;
    const fresh = clip.current.map((e) => ({ ...JSON.parse(JSON.stringify(e)) as El, id: uid(), x: e.x + offset, y: e.y + offset }));
    clip.current = fresh.map((e) => ({ ...e }));
    editSlide((s) => ({ ...s, els: [...s.els, ...fresh] })); setSelected(fresh.map((e) => e.id)); setCell_(null);
  };
  const dupEl = () => { if (!sels.length) return; copy(); paste(24); };
  const order = (front: boolean) => { if (sels.length) editSlide((s) => { const mine = s.els.filter((e) => selected.includes(e.id)), rest = s.els.filter((e) => !selected.includes(e.id)); return { ...s, els: front ? [...rest, ...mine] : [...mine, ...rest] }; }); };
  /** a drag on the canvas: the first change of a drag is the one undo remembers */
  const onPatch = (p: Patch, first: boolean) => editSlide((s) => ({
    ...s, els: s.els.map((e) => {
      const patch = p[e.id]; if (!patch) return e;
      let n = { ...e, ...patch } as El;
      if ('x' in patch || 'y' in patch || 'w' in patch || 'h' in patch) {
        const f = clampFrame({ x: n.x, y: n.y, w: n.w, h: n.h }, deck, n.kind === 'line');
        n = e.kind === 'table' && (f.w !== e.w || f.h !== e.h) ? { ...resizeTable(e, f.w, f.h), x: f.x, y: f.y, ...(n.rot ? { rot: n.rot } : {}) } : { ...n, ...f };
      }
      return n;
    }),
  }), first);

  // ---- arrange
  const alignTo = (how: 'left' | 'centre' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (!sels.length) return;
    const bs = new Map(sels.map((e) => [e.id, bounds(e)]));
    const all = [...bs.values()];
    const box = sels.length > 1 ? { x1: Math.min(...all.map((q) => q.x)), y1: Math.min(...all.map((q) => q.y)), x2: Math.max(...all.map((q) => q.x + q.w)), y2: Math.max(...all.map((q) => q.y + q.h)) } : { x1: 0, y1: 0, x2: deck.w, y2: deck.h };
    editSel((e) => {
      const q = bs.get(e.id)!;
      const dx = how === 'left' ? box.x1 - q.x : how === 'right' ? box.x2 - (q.x + q.w) : how === 'centre' ? (box.x1 + box.x2) / 2 - (q.x + q.w / 2) : 0;
      const dy = how === 'top' ? box.y1 - q.y : how === 'bottom' ? box.y2 - (q.y + q.h) : how === 'middle' ? (box.y1 + box.y2) / 2 - (q.y + q.h / 2) : 0;
      return { ...e, x: Math.round(e.x + dx), y: Math.round(e.y + dy) } as El;
    });
  };
  const distribute = (axis: 'x' | 'y') => {
    if (sels.length < 3) return;
    const size = axis === 'x' ? 'w' : 'h';
    const a = sels.map((e) => ({ e, q: bounds(e) })).sort((p, q) => p.q[axis] - q.q[axis]);
    const span = a[a.length - 1].q[axis] + a[a.length - 1].q[size] - a[0].q[axis], total = a.reduce((n, o) => n + o.q[size], 0), gap = (span - total) / (a.length - 1);
    const shift = new Map<string, number>(); let pos = a[0].q[axis];
    for (const o of a) { shift.set(o.e.id, pos - o.q[axis]); pos += o.q[size] + gap; }
    editSel((e) => ({ ...e, [axis]: Math.round(e[axis] + (shift.get(e.id) ?? 0)) }) as El);
  };
  const turn = (deg: number) => editSel((e) => ({ ...e, rot: (((e.rot ?? 0) + deg) % 360 + 360) % 360 || undefined }) as El);

  // ---- formatting: on the selection while typing in a box, on every text box (or the table's cell) selected otherwise
  const tableCells = (t: TableEl): { r: number; c: number }[] => (activeCell ? [{ r: activeCell.r, c: activeCell.c }] : t.cells.flatMap((row, r) => row.map((_, c) => ({ r, c }))));
  const cellPatch = (t: TableEl, patch: Partial<TCell>) => { let n = t; for (const { r, c } of tableCells(t)) n = setCell(n, r, c, patch); return n; };
  const formatRuns = (patch: Partial<Run>) => {
    if (editing && editRef.current) {
      const d = document; editRef.current.focus();
      if ('b' in patch) d.execCommand('bold'); else if ('i' in patch) d.execCommand('italic'); else if ('u' in patch) d.execCommand('underline');
      else if (patch.color) d.execCommand('foreColor', false, patch.color);
      else if (patch.font) d.execCommand('fontName', false, patch.font);
      else if (patch.size) { d.execCommand('fontSize', false, '7'); editRef.current.querySelectorAll<HTMLElement>('[style*="xxx-large"], font[size="7"]').forEach((n) => { n.style.fontSize = `${(patch.size! * 96) / 72}px`; n.removeAttribute('size'); }); }
      return;
    }
    const flagged = (v: boolean | undefined) => v || undefined;
    editSel((e) => {
      if (e.kind === 'text') return { ...e, paras: e.paras.map((p) => ({ ...p, runs: p.runs.map((r) => ({ ...r, ...patch, ...(patch.b === undefined ? {} : { b: flagged(patch.b) }), ...(patch.i === undefined ? {} : { i: flagged(patch.i) }), ...(patch.u === undefined ? {} : { u: flagged(patch.u) }) })) })) };
      if (e.kind === 'table') return cellPatch(e, { ...(patch.b !== undefined ? { b: patch.b } : {}), ...(patch.i !== undefined ? { i: patch.i } : {}), ...(patch.color ? { color: patch.color } : {}), ...(patch.size ? { size: patch.size } : {}) });
      return e;
    });
  };
  const textEls = sels.filter((e): e is TextEl => e.kind === 'text');
  const tableCellsNow = table ? tableCells(table).map(({ r, c }) => table.cells[r][c]) : [];
  const allRuns = textEls.flatMap((e) => e.paras.flatMap((p) => p.runs));
  const flag = (k: 'b' | 'i' | 'u') => (table ? k !== 'u' && tableCellsNow.every((c) => !!c[k]) : allRuns.length > 0 && allRuns.every((r) => !!r[k]));
  const toggle = (k: 'b' | 'i' | 'u') => formatRuns({ [k]: editing ? true : !flag(k) });
  const canText = textEls.length > 0 || !!table;
  const setAlign = (align: Para['align']) => {
    if (editing && editRef.current) { const sel = window.getSelection(); const blocks = [...editRef.current.children] as HTMLElement[]; const hit = blocks.filter((b) => sel?.containsNode(b, true)); (hit.length ? hit : blocks).forEach((b) => { b.style.textAlign = align ?? 'left'; if (align && align !== 'left') b.setAttribute('data-align', align); else b.removeAttribute('data-align'); }); return; }
    editSel((e) => (e.kind === 'text' ? { ...e, paras: e.paras.map((p) => ({ ...p, align })) } : e.kind === 'table' && align !== 'justify' ? cellPatch(e, { align: align === 'left' ? undefined : align }) : e));
  };
  const toggleList = (kind: 'bullet' | 'num') => {
    const attr = kind === 'bullet' ? 'data-bullet' : 'data-num', other = kind === 'bullet' ? 'data-num' : 'data-bullet';
    if (editing && editRef.current) { const blocks = [...editRef.current.children] as HTMLElement[]; const on = !blocks.every((b) => b.hasAttribute(attr)); blocks.forEach((b) => { b.removeAttribute(other); if (on) b.setAttribute(attr, '1'); else b.removeAttribute(attr); }); return; }
    const on = !(textEls.length > 0 && textEls.every((e) => e.paras.every((p) => p[kind === 'bullet' ? 'bullet' : 'num'])));
    editSel((e) => (e.kind === 'text' ? { ...e, paras: e.paras.map((p) => ({ ...p, bullet: kind === 'bullet' ? on || undefined : undefined, num: kind === 'num' ? on || undefined : undefined })) } : e));
  };
  const setSpacing = (lh: number | undefined) => {
    if (editing && editRef.current) { (([...editRef.current.children]) as HTMLElement[]).forEach((b) => { if (lh) { b.setAttribute('data-lh', String(lh)); b.style.lineHeight = String(lh); } else { b.removeAttribute('data-lh'); b.style.lineHeight = ''; } }); return; }
    editSel((e) => (e.kind === 'text' ? { ...e, paras: e.paras.map((p) => ({ ...p, lh })) } : e));
  };
  const setFill = (c: string | undefined) => editSel((e) => (e.kind === 'text' ? { ...e, fill: c } : e.kind === 'table' ? (activeCell ? cellPatch(e, { fill: c }) : c ? { ...e, accent: c } : e) : e));
  const setOutline = (c: string | undefined) => editSel((e) => (e.kind === 'text' ? { ...e, line: c, lineW: c ? e.lineW ?? 2 : undefined } : e.kind === 'line' ? { ...e, color: c ?? e.color } : e.kind === 'table' ? { ...e, border: c ?? e.border } : e));
  const setWeight = (w: number) => editSel((e) => (e.kind === 'text' ? { ...e, lineW: w, line: e.line ?? lineColour } : e.kind === 'line' ? { ...e, width: w } : e));
  const lineEls = sels.filter((e): e is LineEl => e.kind === 'line');
  const patchLines = (patch: Partial<LineEl>) => editSel((e) => (e.kind === 'line' ? { ...e, ...patch } : e));
  const tableEdit = (f: (t: TableEl) => TableEl) => { if (table) editEl(table.id, (e) => f(e as TableEl)); };
  const sizeNow = table ? tableCellsNow[0]?.size ?? DEFAULT_SIZE : allRuns[0]?.size ?? DEFAULT_SIZE;
  const fontNow = allRuns[0]?.font ?? deck.font;
  const weightNow = el?.kind === 'line' ? el.width : el?.kind === 'text' ? el.lineW ?? 1 : 2;

  // ---- keyboard on the page (not while typing in a box or a field)
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
      const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      if (mod && k === 's') { e.preventDefault(); e.stopPropagation(); if (editing) editRef.current?.blur(); setTimeout(() => void doSave(e.shiftKey), 0); return; }
      if (mod && k === 'z' && !typing) { e.preventDefault(); if (e.shiftKey) h.redo(); else h.undo(); return; }
      if (mod && k === 'y' && !typing) { e.preventDefault(); h.redo(); return; }
      if (e.key === 'F5') { e.preventDefault(); setPresent(e.shiftKey ? idx : 0); return; }
      if (typing || editing || editCell) return;
      if (mod && k === 'a') { e.preventDefault(); setSelected(slide.els.map((x) => x.id)); }
      else if (mod && k === 'd') { e.preventDefault(); dupEl(); }
      else if (mod && k === 'c' && sels.length) { copy(); }
      else if (mod && k === 'x' && sels.length) { copy(); delEl(); }
      else if (mod && k === 'v' && clip.current.length) { paste(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && sels.length) { e.preventDefault(); delEl(); }
      else if (e.key === 'Enter' && el?.kind === 'text') { e.preventDefault(); setEditing(el.id); }
      else if (e.key === 'Enter' && table) { e.preventDefault(); setEditCell({ id: table.id, r: activeCell?.r ?? 0, c: activeCell?.c ?? 0 }); }
      else if (e.key === 'Escape') clearSel();
      else if (sels.length && e.key.startsWith('Arrow')) { e.preventDefault(); const d = e.shiftKey ? 10 : 1; editSel((x) => ({ ...x, x: x.x + (e.key === 'ArrowRight' ? d : e.key === 'ArrowLeft' ? -d : 0), y: x.y + (e.key === 'ArrowDown' ? d : e.key === 'ArrowUp' ? -d : 0) })); }
      else if (!sels.length && (e.key === 'ArrowDown' || e.key === 'PageDown')) go(idx + 1);
      else if (!sels.length && (e.key === 'ArrowUp' || e.key === 'PageUp')) go(idx - 1);
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  });

  const reset = () => { if (docPrefs().confirmReset && !window.confirm('Throw away the changes made since the file was opened (or last saved)?')) return; autosave.clear(); setDirty(false); onReset(); };
  const openRecent = (p: string) => { if (!confirmLeave()) return; void desktop()?.openRecent(p).then((r) => { addOpened(r); navigate(editUrl(r.path)); }); };
  const restore = async () => { if (!autosave.found) return; try { h.set((await importPptx(autosave.found.bytes)).deck); setDirty(true); setDirtyState(true); saver.setMessage('Restored the backed-up changes'); } catch { saver.setMessage('The backup could not be read'); } autosave.dismiss(); };
  const edit = (name: 'cut' | 'copy' | 'paste') => { const d = desktop(); if (d) d.editCommand(name); else document.execCommand(name); };

  const newItems: MenuItem[] = LAYOUTS.map((l) => ({ label: l.label, run: () => addLayout(l) }));
  const layoutItems: MenuItem[] = LAYOUTS.map((l) => ({ label: l.label, run: () => useLayout(l) }));
  const hasSel = sels.length > 0;
  const menus: MenuDef[] = [
    { label: 'File', items: [
      { label: 'Home', keys: 'Ctrl+Alt+H', run: () => goHome(navigate) }, sep,
      { label: 'New presentation', keys: 'Ctrl+N', run: () => goNew(navigate, 'pptx') }, { label: 'Open…', keys: 'Ctrl+O', run: () => openFileDialog(navigate) },
      { label: 'Open recent', disabled: recent.length === 0, sub: recent.map((r) => ({ label: r.name, run: () => openRecent(r.path) })) }, sep,
      { label: 'Save', keys: 'Ctrl+S', run: () => void doSave() }, { label: 'Save as…', keys: 'Ctrl+Shift+S', run: () => void doSave(true) }, { label: 'Reset session edits', run: reset }, sep, { label: 'Quit', keys: 'Ctrl+Q', run: () => desktop()?.windowControl?.('close') },
    ] },
    { label: 'Edit', items: [
      { label: 'Undo', keys: 'Ctrl+Z', disabled: !h.canUndo, run: h.undo }, { label: 'Redo', keys: 'Ctrl+Shift+Z', disabled: !h.canRedo, run: h.redo }, sep,
      { label: 'Cut', keys: 'Ctrl+X', run: () => edit('cut') }, { label: 'Copy', keys: 'Ctrl+C', run: () => edit('copy') }, { label: 'Paste', keys: 'Ctrl+V', run: () => edit('paste') }, sep,
      { label: 'Select all', keys: 'Ctrl+A', run: () => setSelected(slide.els.map((x) => x.id)) }, { label: 'Duplicate', keys: 'Ctrl+D', disabled: !hasSel, run: dupEl }, { label: 'Delete', keys: 'Delete', disabled: !hasSel, run: delEl },
    ] },
    { label: 'View', items: [
      { label: 'Present from the first slide', keys: 'F5', run: () => setPresent(0) }, { label: 'Present from this slide', keys: 'Shift+F5', run: () => setPresent(idx) }, sep,
      { label: 'Speaker notes', check: notesOpen === 'on', run: () => setNotesOpen(notesOpen === 'on' ? 'off' : 'on') }, { label: 'Fit slide to window', check: zoom === 0, run: () => setZoom(0) }, { label: 'Zoom in', run: () => setZoom(Math.min(300, Math.round(scale * 100) + 10)) }, { label: 'Zoom out', run: () => setZoom(Math.max(20, Math.round(scale * 100) - 10)) }, sep,
      { label: 'Full screen', keys: 'F11', run: () => desktop()?.windowControl?.('fullscreen') },
    ] },
    { label: 'Insert', items: [
      { label: 'Text box', run: addText }, { label: 'Shape', sub: SHAPES.map((g) => ({ label: GEOMETRY_LABELS[g], run: () => addShape(g) })) }, { label: 'Line', run: () => addLine(false) }, { label: 'Arrow', run: () => addLine(true) },
      { label: 'Table…', run: () => setTableDlg({ rows: 3, cols: 3 }) }, { label: 'Image…', run: () => fileInput.current?.click() }, sep, { label: 'New slide', sub: newItems },
    ] },
    { label: 'Slide', items: [
      { label: 'New slide', sub: newItems }, { label: 'Layout', sub: layoutItems }, { label: 'Choose a layout…', run: () => setPicker('apply') }, { label: 'Duplicate slide', run: dupSlide }, { label: 'Delete slide', run: delSlide }, sep,
      { label: 'Move up', disabled: idx === 0, run: () => moveSlide(idx, idx - 1) }, { label: 'Move down', disabled: idx === deck.slides.length - 1, run: () => moveSlide(idx, idx + 1) }, sep,
      { label: 'Design', sub: DESIGNS.map((g) => ({ label: g.name, run: () => applyDesign(g) })) },
      { label: 'Background colour', sub: [...BG.map(([l, c]): MenuItem => ({ label: l, check: (slide.bg ?? null) === c, run: () => editSlide((s) => ({ ...s, bg: c ?? undefined })) })), { label: 'Use on every slide', run: () => commit((d) => ({ ...d, slides: d.slides.map((s) => ({ ...s, bg: slide.bg })) })) }] },
      { label: 'Slide size', sub: [{ label: 'Widescreen 16:9', check: Math.round((deck.w / deck.h) * 100) === 178, run: () => resizeDeck(1280, 720) }, { label: 'Standard 4:3', check: Math.round((deck.w / deck.h) * 100) === 133, run: () => resizeDeck(960, 720) }] },
    ] },
    { label: 'Format', items: [
      { label: 'Bold', check: flag('b'), disabled: !canText, run: () => toggle('b') }, { label: 'Italic', check: flag('i'), disabled: !canText, run: () => toggle('i') }, { label: 'Underline', check: flag('u'), disabled: !canText || !!table, run: () => toggle('u') }, sep,
      { label: 'Align left', run: () => setAlign('left') }, { label: 'Align centre', run: () => setAlign('center') }, { label: 'Align right', run: () => setAlign('right') }, { label: 'Bulleted list', run: () => toggleList('bullet') }, { label: 'Numbered list', run: () => toggleList('num') },
      { label: 'Line spacing', sub: LINE_SPACING.map(([l, v]): MenuItem => ({ label: l, run: () => setSpacing(v) })) }, sep,
      { label: 'Text position', disabled: textEls.length === 0, sub: (['top', 'middle', 'bottom'] as const).map((v): MenuItem => ({ label: v[0].toUpperCase() + v.slice(1), check: el?.kind === 'text' && (el.valign ?? 'top') === v, run: () => editSel((e) => (e.kind === 'text' ? { ...e, valign: v } : e)) })) },
      { label: 'Shape', disabled: !el || el.kind !== 'text', sub: SHAPES.map((g) => ({ label: GEOMETRY_LABELS[g], check: el?.kind === 'text' && (el.geometry ?? 'rect') === g, run: () => editSel((e) => (e.kind === 'text' ? { ...e, geometry: g === 'rect' ? undefined : g } : e)) })) },
      { label: 'Dashed line', disabled: lineEls.length === 0, check: lineEls.length > 0 && lineEls.every((l) => l.dash), run: () => patchLines({ dash: !lineEls.every((l) => l.dash) || undefined }) },
      { label: 'Arrow at the start', disabled: lineEls.length === 0, check: lineEls.length > 0 && lineEls.every((l) => l.head), run: () => patchLines({ head: !lineEls.every((l) => l.head) || undefined }) },
      { label: 'Arrow at the end', disabled: lineEls.length === 0, check: lineEls.length > 0 && lineEls.every((l) => l.tail), run: () => patchLines({ tail: !lineEls.every((l) => l.tail) || undefined }) },
    ] },
    { label: 'Arrange', items: [
      { label: 'Bring to front', disabled: !hasSel, run: () => order(true) }, { label: 'Send to back', disabled: !hasSel, run: () => order(false) }, sep,
      { label: 'Align left', disabled: !hasSel, run: () => alignTo('left') }, { label: 'Align centre', disabled: !hasSel, run: () => alignTo('centre') }, { label: 'Align right', disabled: !hasSel, run: () => alignTo('right') },
      { label: 'Align top', disabled: !hasSel, run: () => alignTo('top') }, { label: 'Align middle', disabled: !hasSel, run: () => alignTo('middle') }, { label: 'Align bottom', disabled: !hasSel, run: () => alignTo('bottom') }, sep,
      { label: 'Distribute horizontally', disabled: sels.length < 3, run: () => distribute('x') }, { label: 'Distribute vertically', disabled: sels.length < 3, run: () => distribute('y') }, sep,
      { label: 'Rotate right 90°', disabled: !hasSel, run: () => turn(90) }, { label: 'Rotate left 90°', disabled: !hasSel, run: () => turn(-90) }, { label: 'Reset rotation', disabled: !sels.some((e) => e.rot), run: () => editSel((e) => ({ ...e, rot: undefined }) as El) },
    ] },
    ...(table ? [{ label: 'Table', items: [
      { label: 'Insert row above', run: () => tableEdit((t) => insertRow(t, activeCell?.r ?? 0)) }, { label: 'Insert row below', run: () => tableEdit((t) => insertRow(t, (activeCell?.r ?? t.rows.length - 1) + 1)) },
      { label: 'Insert column left', run: () => tableEdit((t) => insertCol(t, activeCell?.c ?? 0)) }, { label: 'Insert column right', run: () => tableEdit((t) => insertCol(t, (activeCell?.c ?? t.cols.length - 1) + 1)) }, sep,
      { label: 'Delete row', run: () => tableEdit((t) => deleteRow(t, activeCell?.r ?? t.rows.length - 1)) }, { label: 'Delete column', run: () => tableEdit((t) => deleteCol(t, activeCell?.c ?? t.cols.length - 1)) }, sep,
      { label: 'Header row', check: table.header, run: () => tableEdit((t) => ({ ...t, header: !t.header })) }, { label: 'Banded rows', check: table.banded, run: () => tableEdit((t) => ({ ...t, banded: !t.banded })) },
    ] } as MenuDef] : []),
  ];

  const thumbScale = 138 / deck.w;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <MenuBar menus={menus} label="Presentation menu" />
      <DocHeader name={saver.name} path={saver.path} dirty={dirty} busy={saver.busy} onSave={() => void doSave()} onSaveAs={() => void doSave(true)} />
      {autosave.found && (
        <div role="alert" className="tk-expand mx-3 mb-2 flex flex-wrap items-center gap-2 rounded-theme border border-accent bg-accent/10 px-3 py-2 text-sm">
          <span className="flex-1">Unsaved changes from {new Date(autosave.found.at).toLocaleString()} were backed up. Restore them?</span>
          <button className="btn btn-accent text-sm" onClick={() => void restore()}>Restore</button><button className="btn text-sm" onClick={() => { autosave.clear(); autosave.dismiss(); }}>Discard</button>
        </div>
      )}
      {warnings.length > 0 && (
        <div role="alert" className="mx-3 mb-2 rounded-theme border border-warn bg-warn/10 px-3 py-2 text-sm">
          <b>Parts of this presentation cannot be edited here:</b> {warnings.join(' ')} <span className="text-muted">Saving writes a new file without them (a copy of the original is kept); use Save as to keep the original untouched.</span>
        </div>
      )}
      <div role="toolbar" aria-label="Formatting" className="tb-bar bt-top flex flex-wrap items-center gap-px px-2 py-1">
        <Btn label="Undo (Ctrl+Z)" onClick={h.undo} disabled={!h.canUndo}><Undo2 size={16} /></Btn>
        <Btn label="Redo (Ctrl+Shift+Z)" onClick={h.redo} disabled={!h.canRedo}><Redo2 size={16} /></Btn>
        <Sep />
        <Btn label="New slide" onClick={() => addLayout(layoutById('content'))}><span className="flex items-center gap-1 text-sm"><Plus size={15} />Slide</span></Btn>
        <Btn label="Choose a layout for the new slide" onClick={() => setPicker('new')}><LayoutTemplate size={16} /></Btn>
        <Btn label="Change this slide's layout" onClick={() => setPicker('apply')}><span className="text-xs">Layout</span></Btn>
        <Sep />
        <Btn label="Text box" onClick={addText}><Type size={16} /></Btn>
        <Btn label="Rectangle" onClick={() => addShape('rect')}><Square size={16} /></Btn>
        <Btn label="Ellipse" onClick={() => addShape('ellipse')}><Circle size={16} /></Btn>
        <select aria-label="Insert shape" className="input !w-14 !px-1 !py-1 text-sm" value="" title="More shapes" onChange={(e) => { if (e.target.value) addShape(e.target.value as Geometry); e.target.value = ''; }}>
          <option value="">★</option>{SHAPES.map((g) => <option key={g} value={g}>{GEOMETRY_LABELS[g]}</option>)}
        </select>
        <Btn label="Line" onClick={() => addLine(false)}><Minus size={16} /></Btn>
        <Btn label="Arrow" onClick={() => addLine(true)}><MoveRight size={16} /></Btn>
        <Btn label="Table" onClick={() => setTableDlg({ rows: 3, cols: 3 })}><Table2 size={16} /></Btn>
        <Btn label="Image" onClick={() => fileInput.current?.click()}><ImageIcon size={16} /></Btn>
        <Sep />
        <FontBox value={fontNow} onPick={(f) => formatRuns({ font: f })} />
        <input aria-label="Font size" list="slide-font-sizes" className="input !w-14 !px-1 !py-1 text-center text-sm" inputMode="decimal" key={`${selected.join()}-${sizeNow}`} defaultValue={String(sizeNow)} disabled={!canText}
          onFocus={(e) => e.currentTarget.select()} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} onBlur={(e) => { const n = Number(e.target.value.replace(',', '.')); if (n >= 1 && n <= 400 && n !== sizeNow) formatRuns({ size: n }); }} />
        <datalist id="slide-font-sizes">{[10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 44, 54, 66, 80, ...SIZES.filter((s) => s > 80)].map((z) => <option key={z} value={z} />)}</datalist>
        <Sep />
        <Btn label="Bold" active={flag('b')} disabled={!canText} onClick={() => toggle('b')}><Bold size={16} /></Btn>
        <Btn label="Italic" active={flag('i')} disabled={!canText} onClick={() => toggle('i')}><Italic size={16} /></Btn>
        <Btn label="Underline" active={flag('u')} disabled={!canText || !!table} onClick={() => toggle('u')}><Underline size={16} /></Btn>
        <SplitColour label="Text colour" icon={<Baseline size={15} />} last={textColour} onApply={(c) => formatRuns({ color: c })} onPick={(c) => { setTextColour(c); formatRuns({ color: c }); }} />
        <SplitColour label="Fill colour" icon={<PaintBucket size={15} />} last={fillColour} onApply={(c) => setFill(c)} onPick={(c) => { setFillColour(c); setFill(c); }} />
        <SplitColour label="Outline and line colour" icon={<Palette size={15} />} last={lineColour} onApply={(c) => setOutline(c)} onPick={(c) => { setLineColour(c); setOutline(c); }} />
        <Btn label="No fill" disabled={textEls.length === 0 || !textEls.some((e) => e.fill)} onClick={() => setFill(undefined)}><span className="text-xs">No fill</span></Btn>
        <select aria-label="Line weight" className="input !w-16 !px-1 !py-1 text-sm" disabled={!sels.some((e) => e.kind === 'text' || e.kind === 'line')} value={String(weightNow)} onChange={(e) => setWeight(Number(e.target.value))}>
          {[...new Set([1, 2, 3, 4, 6, 8, weightNow])].sort((a, b) => a - b).map((w) => <option key={w} value={w}>{Math.round(w * 10) / 10} px</option>)}
        </select>
        <Sep />
        <Btn label="Align left" disabled={!canText} onClick={() => setAlign('left')}><AlignLeft size={16} /></Btn>
        <Btn label="Align centre" disabled={!canText} onClick={() => setAlign('center')}><AlignCenter size={16} /></Btn>
        <Btn label="Align right" disabled={!canText} onClick={() => setAlign('right')}><AlignRight size={16} /></Btn>
        <Btn label="Bulleted list" disabled={textEls.length === 0} onClick={() => toggleList('bullet')}><List size={16} /></Btn>
        <Btn label="Numbered list" disabled={textEls.length === 0} onClick={() => toggleList('num')}><ListOrdered size={16} /></Btn>
        <Sep />
        <Btn label="Rotate right 90°" disabled={!hasSel} onClick={() => turn(90)}><RotateCw size={16} /></Btn>
        <Btn label="Bring to front" disabled={!hasSel} onClick={() => order(true)}><BringToFront size={16} /></Btn>
        <Btn label="Send to back" disabled={!hasSel} onClick={() => order(false)}><SendToBack size={16} /></Btn>
        <Btn label="Duplicate (Ctrl+D)" disabled={!hasSel} onClick={dupEl}><Copy size={16} /></Btn>
        <Btn label="Delete" disabled={!hasSel} onClick={delEl}><Trash2 size={16} /></Btn>
        <span className="flex-1" />
        <button type="button" className="btn btn-accent inline-flex items-center gap-1.5 text-sm" onClick={() => setPresent(0)} title="Present (F5)"><Play size={14} />Present</button>
      </div>
      <div className="flex min-h-0 flex-1">
        <nav aria-label="Slides" className="w-44 shrink-0 space-y-1 overflow-y-auto border-r border-line p-2">
          {deck.slides.map((s, i) => (
            <div key={s.id} className={`flex items-start gap-1 ${arrived.has(s.id) ? 'tk-arrive' : ''}`}>
              <span className="w-4 pt-1 text-right text-xs text-muted tabular-nums">{i + 1}</span>
              <button type="button" className={`slide-thumb ${dragOver === i ? 'drop' : ''}`} aria-current={i === idx} aria-label={`Slide ${i + 1}`} draggable onClick={() => go(i)}
                onDragStart={() => { dragFrom.current = i; }} onDragOver={(e) => { e.preventDefault(); setDragOver(i); }} onDragLeave={() => setDragOver(null)} onDrop={() => { setDragOver(null); if (dragFrom.current !== null) moveSlide(dragFrom.current, i); dragFrom.current = null; }}>
                <SlideStage slide={s} deck={deck} scale={thumbScale} />
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost w-full text-sm" onClick={() => addLayout(layoutById('content'))}><Plus size={14} className="mr-1 inline" />New slide</button>
        </nav>
        <div className="flex min-w-0 flex-1 flex-col">
          <div ref={stage} className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-raised p-6">
            <div key={slide.id} className="tk-swap">
              <SlideCanvas slide={slide} deck={deck} scale={scale} selected={selected} editing={editing} cell={cell} editCell={editCell} onSelect={(ids) => setSelected(ids)} onEdit={setEditing} onPatch={onPatch} editRef={editRef}
                onText={(id, paras) => { setEditing(null); editEl(id, (e) => ({ ...e, paras }) as TextEl); }}
                onCell={setCell_} onEditCell={setEditCell}
                onCommitCell={(c, text, next) => {
                  setEditCell(null);
                  editEl(c.id, (e) => (e.kind === 'table' && e.cells[c.r]?.[c.c] && e.cells[c.r][c.c].t !== text ? setCell(e, c.r, c.c, { t: text }) : e));
                  setCell_(c);
                  if (next === 'right') { const t = slide.els.find((e) => e.id === c.id); if (t?.kind === 'table') { const last = c.c + 1 >= t.cols.length; const n = last ? { id: c.id, r: Math.min(t.rows.length - 1, c.r + 1), c: 0 } : { id: c.id, r: c.r, c: c.c + 1 }; setCell_(n); setEditCell(n); } }
                }} />
            </div>
          </div>
          {notesOpen === 'on' && (
            <textarea aria-label="Speaker notes" className="input !rounded-none h-24 w-full resize-none border-x-0 border-b-0 text-sm" placeholder="Speaker notes for this slide" value={slide.notes} onChange={(e) => editSlide((s) => ({ ...s, notes: e.target.value }), false)} />
          )}
        </div>
      </div>
      <StatusBar editor={null} zoom={Math.round(scale * 100)} setZoom={(z) => setZoom(Math.max(20, Math.min(300, z)))} message={saver.message} extra={<span className="tabular-nums">Slide {idx + 1} of {deck.slides.length}{sels.length > 1 ? ` · ${sels.length} selected` : ''}</span>} />
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/gif,image/bmp,image/webp" hidden onChange={(e) => { addImage(e.target.files?.[0]); e.target.value = ''; }} />
      {present !== null && <Present deck={deck} start={present} onClose={(at) => { setPresent(null); setCur(at); }} />}
      {picker && (
        <Dialog title={picker === 'new' ? 'New slide: choose a layout' : 'Change the layout of this slide'} wide onClose={() => setPicker(null)}>
          <div role="listbox" aria-label="Layouts" className="grid grid-cols-3 gap-3">
            {LAYOUTS.map((l) => (
              <button key={l.id} type="button" role="option" aria-selected={false} aria-label={l.label} className="slide-thumb flex flex-col items-center gap-1 !p-1.5 hover:!border-accent" onClick={() => { if (picker === 'new') addLayout(l); else useLayout(l); setPicker(null); }}>
                <SlideStage slide={slideFromLayout(l, deck)} deck={deck} scale={170 / deck.w} hints />
                <span className="text-xs">{l.label}</span>
              </button>
            ))}
          </div>
        </Dialog>
      )}
      {tableDlg && (
        <Dialog title="Insert a table" onClose={() => setTableDlg(null)} footer={<><button className="btn" onClick={() => setTableDlg(null)}>Cancel</button><button className="btn btn-accent" onClick={() => { addTable(tableDlg.rows, tableDlg.cols); setTableDlg(null); }}>Insert</button></>}>
          <div className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-2">Rows <input type="number" min={1} max={20} className="input !w-20" value={tableDlg.rows} onChange={(e) => setTableDlg({ ...tableDlg, rows: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} /></label>
            <label className="flex items-center gap-2">Columns <input type="number" min={1} max={12} className="input !w-20" value={tableDlg.cols} onChange={(e) => setTableDlg({ ...tableDlg, cols: Math.max(1, Math.min(12, Number(e.target.value) || 1)) })} /></label>
          </div>
        </Dialog>
      )}
    </div>
  );
}
