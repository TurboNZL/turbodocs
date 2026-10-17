import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlignCenter, AlignLeft, AlignRight, Baseline, Bold, BringToFront, Circle, Copy, Image as ImageIcon, Italic, List, PaintBucket, Play, Plus, Redo2, SendToBack, Square, Trash2, Type, Underline, Undo2 } from 'lucide-react';
import { SlideCanvas, SlideStage } from './SlideCanvas.tsx';
import { Present } from './Present.tsx';
import { blankSlide, clampFrame, cloneSlide, contentSlide, DEFAULT_SIZE, para, textBox, titleSlide, uid, type Deck, type El, type Frame, type ImageEl, type Para, type Run, type Slide, type TextEl } from './model.ts';
import { exportPptx, importPptx } from './pptx.ts';
import { MenuBar, type MenuDef, type MenuItem } from '../components/MenuBar.tsx';
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

/**
 * The presentation editor (the Slides app): a concept, usable but plain. Slides in a strip on the left, the slide in the middle (move, resize, double-click a text
 * box to type), speaker notes below, Present for the show. Text boxes double as shapes (give one a fill and a rectangle or ellipse). Saves a new .pptx.
 */
export function SlidesPane({ initial, path, name, warnings, onReset }: { initial: Deck; path: string | null; name: string; warnings: string[]; onReset: () => void }) {
  const navigate = useNavigate();
  const h = useHistory(initial);
  const deck = h.value;
  const [cur, setCur] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [dirty, setDirtyState] = useState(false);
  const [present, setPresent] = useState<number | null>(null);
  const [recent, setRecent] = useState<{ path: string; name: string }[]>([]);
  const [zoom, setZoom] = usePref('slides.zoom', 0); // 0 = fit
  const [notesOpen, setNotesOpen] = usePref('slides.notes', 'on');
  const [textColour, setTextColour] = useState('#c80000');
  const [fillColour, setFillColour] = useState('#1f6f5c');
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [fitW, setFitW] = useState({ w: 800, h: 450 });
  const stage = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLDivElement | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const dragFrom = useRef<number | null>(null);
  const dragging = useRef(false);
  const touchRef = useRef<() => void>(() => undefined);
  const deckRef = useRef(deck); deckRef.current = deck;
  const clip = useRef<El | null>(null);

  const slide = deck.slides[Math.min(cur, deck.slides.length - 1)];
  const idx = deck.slides.indexOf(slide);
  const el = slide.els.find((e) => e.id === selected) ?? null;
  const arrived = useArrivals(deck.slides.map((s) => s.id));

  const commit = useCallback((f: (d: Deck) => Deck, record = true) => { h.set(f, record); setDirty(true); setDirtyState(true); touchRef.current(); }, [h]);
  const editSlide = (f: (s: Slide) => Slide, record = true) => commit((d) => ({ ...d, slides: d.slides.map((s, i) => (i === idx ? f(s) : s)) }), record);
  const editEl = (id: string, f: (e: El) => El, record = true) => editSlide((s) => ({ ...s, els: s.els.map((e) => (e.id === id ? f(e) : e)) }), record);

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
  const go = (i: number) => { if (editing) editRef.current?.blur(); setCur(Math.max(0, Math.min(deck.slides.length - 1, i))); setSelected(null); setEditing(null); };
  const addSlide = (make: (d: { w: number; h: number }) => Slide) => { const s = make(deck); commit((d) => ({ ...d, slides: [...d.slides.slice(0, idx + 1), s, ...d.slides.slice(idx + 1)] })); setCur(idx + 1); setSelected(null); };
  const dupSlide = () => { commit((d) => ({ ...d, slides: [...d.slides.slice(0, idx + 1), cloneSlide(slide), ...d.slides.slice(idx + 1)] })); setCur(idx + 1); };
  const delSlide = () => { if (deck.slides.length < 2) { editSlide((s) => ({ ...s, els: [], bg: undefined })); return; } commit((d) => ({ ...d, slides: d.slides.filter((_, i) => i !== idx) })); setCur(Math.max(0, idx - 1)); setSelected(null); };
  const moveSlide = (from: number, to: number) => { if (from === to || to < 0 || to >= deck.slides.length) return; commit((d) => { const a = [...d.slides]; const [s] = a.splice(from, 1); a.splice(to, 0, s); return { ...d, slides: a }; }); setCur(to); };
  const resizeDeck = (w: number, hh: number) => commit((d) => ({ ...d, w, h: hh, slides: d.slides.map((s) => ({ ...s, els: s.els.map((e) => ({ ...e, x: (e.x * w) / d.w, y: (e.y * hh) / d.h, w: (e.w * w) / d.w, h: (e.h * hh) / d.h })) })) }));

  // ---- elements
  const addEl = (e: El) => { editSlide((s) => ({ ...s, els: [...s.els, e] })); setSelected(e.id); };
  const addText = () => { const b = textBox({ x: deck.w * 0.3, y: deck.h * 0.4, w: deck.w * 0.4, h: 80 }, [para('Text', { size: 24 })]); addEl(b); setTimeout(() => setEditing(b.id), 0); };
  const addShape = (g: 'rect' | 'ellipse') => addEl(textBox({ x: deck.w * 0.35, y: deck.h * 0.35, w: 240, h: g === 'ellipse' ? 160 : 140 }, [], { geometry: g === 'ellipse' ? 'ellipse' : undefined, fill: fillColour, valign: 'middle' }));
  const addImage = (file: File | undefined) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => { const src = String(r.result); const im = new window.Image(); im.onload = () => { const k = Math.min(1, (deck.w * 0.6) / (im.naturalWidth || 1), (deck.h * 0.7) / (im.naturalHeight || 1)); const w = Math.round((im.naturalWidth || 400) * k), hh = Math.round((im.naturalHeight || 300) * k); addEl({ id: uid(), kind: 'image', src, x: Math.round((deck.w - w) / 2), y: Math.round((deck.h - hh) / 2), w, h: hh } as ImageEl); }; im.src = src; };
    r.readAsDataURL(file);
  };
  const delEl = () => { if (el) { editSlide((s) => ({ ...s, els: s.els.filter((e) => e.id !== el.id) })); setSelected(null); setEditing(null); } };
  const dupEl = () => { if (!el) return; const c = { ...JSON.parse(JSON.stringify(el)) as El, id: uid(), x: el.x + 24, y: el.y + 24 }; addEl(c); };
  const order = (front: boolean) => { if (el) editSlide((s) => ({ ...s, els: front ? [...s.els.filter((e) => e.id !== el.id), el] : [el, ...s.els.filter((e) => e.id !== el.id)] })); };
  const onFrame = (id: string, f: Frame, record: boolean) => {
    if (record) { dragging.current = false; return; }
    const first = !dragging.current; dragging.current = true;
    editEl(id, (e) => ({ ...e, ...clampFrame(f, deck) }), first);
  };
  /** formatting: on the selection while typing in a box, on every run of the selected box otherwise */
  const formatRuns = (patch: Partial<Run>) => {
    if (editing && editRef.current) {
      const d = document; editRef.current.focus();
      if ('b' in patch) d.execCommand('bold'); else if ('i' in patch) d.execCommand('italic'); else if ('u' in patch) d.execCommand('underline');
      else if (patch.color) d.execCommand('foreColor', false, patch.color);
      else if (patch.font) d.execCommand('fontName', false, patch.font);
      else if (patch.size) { d.execCommand('fontSize', false, '7'); editRef.current.querySelectorAll<HTMLElement>('[style*="xxx-large"], font[size="7"]').forEach((n) => { n.style.fontSize = `${(patch.size! * 96) / 72}px`; n.removeAttribute('size'); }); }
      return;
    }
    if (el?.kind !== 'text') return;
    editEl(el.id, (e) => ({ ...e, paras: (e as TextEl).paras.map((p) => ({ ...p, runs: p.runs.map((r) => ({ ...r, ...patch, ...(patch.b === undefined ? {} : { b: patch.b || undefined }), ...(patch.i === undefined ? {} : { i: patch.i || undefined }), ...(patch.u === undefined ? {} : { u: patch.u || undefined }) })) })) }) as TextEl);
  };
  const allRuns = el?.kind === 'text' ? el.paras.flatMap((p) => p.runs) : [];
  const flag = (k: 'b' | 'i' | 'u') => allRuns.length > 0 && allRuns.every((r) => !!r[k]);
  const toggle = (k: 'b' | 'i' | 'u') => formatRuns({ [k]: editing ? true : !flag(k) });
  const setAlign = (align: Para['align']) => {
    if (el?.kind !== 'text') return;
    if (editing && editRef.current) { const sel = window.getSelection(); const blocks = [...editRef.current.children] as HTMLElement[]; const hit = blocks.filter((b) => sel?.containsNode(b, true)); (hit.length ? hit : blocks).forEach((b) => { b.style.textAlign = align ?? 'left'; if (align && align !== 'left') b.setAttribute('data-align', align); else b.removeAttribute('data-align'); }); return; }
    editEl(el.id, (e) => ({ ...e, paras: (e as TextEl).paras.map((p) => ({ ...p, align })) }) as TextEl);
  };
  const toggleBullets = () => {
    if (el?.kind !== 'text') return;
    const on = !(el.paras.length > 0 && el.paras.every((p) => p.bullet));
    if (editing && editRef.current) { (([...editRef.current.children]) as HTMLElement[]).forEach((b) => { if (on) b.setAttribute('data-bullet', '1'); else b.removeAttribute('data-bullet'); }); return; }
    editEl(el.id, (e) => ({ ...e, paras: (e as TextEl).paras.map((p) => ({ ...p, bullet: on || undefined })) }) as TextEl);
  };
  const setFill = (c: string | undefined) => { if (el?.kind === 'text') editEl(el.id, (e) => ({ ...e, fill: c }) as TextEl); };
  const sizeNow = allRuns[0]?.size ?? DEFAULT_SIZE;
  const fontNow = allRuns[0]?.font ?? deck.font;

  // ---- keyboard on the page (not while typing in a box or a field)
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); e.stopPropagation(); if (editing) editRef.current?.blur(); setTimeout(() => void doSave(e.shiftKey), 0); return; }
      if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); if (e.shiftKey) h.redo(); else h.undo(); return; }
      if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); h.redo(); return; }
      if (e.key === 'F5') { e.preventDefault(); setPresent(e.shiftKey ? idx : 0); return; }
      if (typing || editing) return;
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); dupEl(); }
      else if (mod && e.key.toLowerCase() === 'c' && el) { clip.current = JSON.parse(JSON.stringify(el)) as El; }
      else if (mod && e.key.toLowerCase() === 'x' && el) { clip.current = JSON.parse(JSON.stringify(el)) as El; delEl(); }
      else if (mod && e.key.toLowerCase() === 'v' && clip.current) { addEl({ ...JSON.parse(JSON.stringify(clip.current)) as El, id: uid(), x: clip.current.x + 20, y: clip.current.y + 20 }); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && el) { e.preventDefault(); delEl(); }
      else if (e.key === 'Enter' && el?.kind === 'text') { e.preventDefault(); setEditing(el.id); }
      else if (e.key === 'Escape') setSelected(null);
      else if (el && e.key.startsWith('Arrow')) { e.preventDefault(); const d = e.shiftKey ? 10 : 1; editEl(el.id, (x) => ({ ...x, x: x.x + (e.key === 'ArrowRight' ? d : e.key === 'ArrowLeft' ? -d : 0), y: x.y + (e.key === 'ArrowDown' ? d : e.key === 'ArrowUp' ? -d : 0) })); }
      else if (!el && (e.key === 'ArrowDown' || e.key === 'PageDown')) go(idx + 1);
      else if (!el && (e.key === 'ArrowUp' || e.key === 'PageUp')) go(idx - 1);
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  });

  const reset = () => { if (docPrefs().confirmReset && !window.confirm('Throw away the changes made since the file was opened (or last saved)?')) return; autosave.clear(); setDirty(false); onReset(); };
  const openRecent = (p: string) => { if (!confirmLeave()) return; void desktop()?.openRecent(p).then((r) => { addOpened(r); navigate(editUrl(r.path)); }); };
  const restore = async () => { if (!autosave.found) return; try { h.set((await importPptx(autosave.found.bytes)).deck); setDirty(true); setDirtyState(true); saver.setMessage('Restored the backed-up changes'); } catch { saver.setMessage('The backup could not be read'); } autosave.dismiss(); };
  const edit = (name: 'cut' | 'copy' | 'paste') => { const d = desktop(); if (d) d.editCommand(name); else document.execCommand(name); };

  const layouts: MenuItem[] = [{ label: 'Title slide', run: () => addSlide(titleSlide) }, { label: 'Title and bullets', run: () => addSlide(contentSlide) }, { label: 'Blank', run: () => addSlide(blankSlide) }];
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
      { label: 'Duplicate', keys: 'Ctrl+D', disabled: !el, run: dupEl }, { label: 'Delete', keys: 'Delete', disabled: !el, run: delEl },
    ] },
    { label: 'View', items: [
      { label: 'Present from the first slide', keys: 'F5', run: () => setPresent(0) }, { label: 'Present from this slide', keys: 'Shift+F5', run: () => setPresent(idx) }, sep,
      { label: 'Speaker notes', check: notesOpen === 'on', run: () => setNotesOpen(notesOpen === 'on' ? 'off' : 'on') }, { label: 'Fit slide to window', check: zoom === 0, run: () => setZoom(0) }, { label: 'Zoom in', run: () => setZoom(Math.min(300, Math.round(scale * 100) + 10)) }, { label: 'Zoom out', run: () => setZoom(Math.max(20, Math.round(scale * 100) - 10)) }, sep,
      { label: 'Full screen', keys: 'F11', run: () => desktop()?.windowControl?.('fullscreen') },
    ] },
    { label: 'Insert', items: [{ label: 'Text box', run: addText }, { label: 'Rectangle', run: () => addShape('rect') }, { label: 'Ellipse', run: () => addShape('ellipse') }, { label: 'Image…', run: () => fileInput.current?.click() }, sep, { label: 'New slide', sub: layouts }] },
    { label: 'Slide', items: [
      { label: 'New slide', sub: layouts }, { label: 'Duplicate slide', run: dupSlide }, { label: 'Delete slide', run: delSlide }, sep,
      { label: 'Move up', disabled: idx === 0, run: () => moveSlide(idx, idx - 1) }, { label: 'Move down', disabled: idx === deck.slides.length - 1, run: () => moveSlide(idx, idx + 1) }, sep,
      { label: 'Background colour', sub: [...BG.map(([l, c]): MenuItem => ({ label: l, check: (slide.bg ?? null) === c, run: () => editSlide((s) => ({ ...s, bg: c ?? undefined })) })), { label: 'Use on every slide', run: () => commit((d) => ({ ...d, slides: d.slides.map((s) => ({ ...s, bg: slide.bg })) })) }] },
      { label: 'Slide size', sub: [{ label: 'Widescreen 16:9', check: Math.round((deck.w / deck.h) * 100) === 178, run: () => resizeDeck(1280, 720) }, { label: 'Standard 4:3', check: Math.round((deck.w / deck.h) * 100) === 133, run: () => resizeDeck(960, 720) }] },
    ] },
    { label: 'Format', items: [
      { label: 'Bold', check: flag('b'), disabled: !el || el.kind !== 'text', run: () => toggle('b') }, { label: 'Italic', check: flag('i'), disabled: !el || el.kind !== 'text', run: () => toggle('i') }, { label: 'Underline', check: flag('u'), disabled: !el || el.kind !== 'text', run: () => toggle('u') }, sep,
      { label: 'Align left', run: () => setAlign('left') }, { label: 'Align centre', run: () => setAlign('center') }, { label: 'Align right', run: () => setAlign('right') }, { label: 'Bulleted list', run: toggleBullets }, sep,
      { label: 'Text position', disabled: el?.kind !== 'text', sub: (['top', 'middle', 'bottom'] as const).map((v): MenuItem => ({ label: v[0].toUpperCase() + v.slice(1), check: el?.kind === 'text' && (el.valign ?? 'top') === v, run: () => el && editEl(el.id, (e) => ({ ...e, valign: v }) as TextEl) })) },
      { label: 'Bring to front', disabled: !el, run: () => order(true) }, { label: 'Send to back', disabled: !el, run: () => order(false) },
    ] },
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
        <Btn label="New slide" onClick={() => addSlide(contentSlide)}><span className="flex items-center gap-1 text-sm"><Plus size={15} />Slide</span></Btn>
        <Btn label="Text box" onClick={addText}><Type size={16} /></Btn>
        <Btn label="Rectangle" onClick={() => addShape('rect')}><Square size={16} /></Btn>
        <Btn label="Ellipse" onClick={() => addShape('ellipse')}><Circle size={16} /></Btn>
        <Btn label="Image" onClick={() => fileInput.current?.click()}><ImageIcon size={16} /></Btn>
        <Sep />
        <FontBox value={fontNow} onPick={(f) => formatRuns({ font: f })} />
        <input aria-label="Font size" list="slide-font-sizes" className="input !w-14 !px-1 !py-1 text-center text-sm" inputMode="decimal" key={`${el?.id}-${sizeNow}`} defaultValue={String(sizeNow)} disabled={el?.kind !== 'text'}
          onFocus={(e) => e.currentTarget.select()} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} onBlur={(e) => { const n = Number(e.target.value.replace(',', '.')); if (n >= 1 && n <= 400 && n !== sizeNow) formatRuns({ size: n }); }} />
        <datalist id="slide-font-sizes">{[10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 44, 54, 66, 80, ...SIZES.filter((s) => s > 80)].map((z) => <option key={z} value={z} />)}</datalist>
        <Sep />
        <Btn label="Bold" active={flag('b')} disabled={el?.kind !== 'text'} onClick={() => toggle('b')}><Bold size={16} /></Btn>
        <Btn label="Italic" active={flag('i')} disabled={el?.kind !== 'text'} onClick={() => toggle('i')}><Italic size={16} /></Btn>
        <Btn label="Underline" active={flag('u')} disabled={el?.kind !== 'text'} onClick={() => toggle('u')}><Underline size={16} /></Btn>
        <SplitColour label="Text colour" icon={<Baseline size={15} />} last={textColour} onApply={(c) => formatRuns({ color: c })} onPick={(c) => { setTextColour(c); formatRuns({ color: c }); }} />
        <SplitColour label="Fill colour" icon={<PaintBucket size={15} />} last={fillColour} onApply={(c) => setFill(c)} onPick={(c) => { setFillColour(c); setFill(c); }} />
        <Btn label="No fill" disabled={el?.kind !== 'text' || !el.fill} onClick={() => setFill(undefined)}><span className="text-xs">No fill</span></Btn>
        <Sep />
        <Btn label="Align left" disabled={el?.kind !== 'text'} onClick={() => setAlign('left')}><AlignLeft size={16} /></Btn>
        <Btn label="Align centre" disabled={el?.kind !== 'text'} onClick={() => setAlign('center')}><AlignCenter size={16} /></Btn>
        <Btn label="Align right" disabled={el?.kind !== 'text'} onClick={() => setAlign('right')}><AlignRight size={16} /></Btn>
        <Btn label="Bulleted list" disabled={el?.kind !== 'text'} onClick={toggleBullets}><List size={16} /></Btn>
        <Sep />
        <Btn label="Bring to front" disabled={!el} onClick={() => order(true)}><BringToFront size={16} /></Btn>
        <Btn label="Send to back" disabled={!el} onClick={() => order(false)}><SendToBack size={16} /></Btn>
        <Btn label="Duplicate (Ctrl+D)" disabled={!el} onClick={dupEl}><Copy size={16} /></Btn>
        <Btn label="Delete" disabled={!el} onClick={delEl}><Trash2 size={16} /></Btn>
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
          <button type="button" className="btn btn-ghost w-full text-sm" onClick={() => addSlide(contentSlide)}><Plus size={14} className="mr-1 inline" />New slide</button>
        </nav>
        <div className="flex min-w-0 flex-1 flex-col">
          <div ref={stage} className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-raised p-6">
            <div key={slide.id} className="tk-swap">
              <SlideCanvas slide={slide} deck={deck} scale={scale} selected={selected} editing={editing} onSelect={setSelected} onEdit={setEditing} onFrame={onFrame} editRef={editRef}
                onText={(id, paras) => { setEditing(null); editEl(id, (e) => ({ ...e, paras }) as TextEl); }} />
            </div>
          </div>
          {notesOpen === 'on' && (
            <textarea aria-label="Speaker notes" className="input !rounded-none h-24 w-full resize-none border-x-0 border-b-0 text-sm" placeholder="Speaker notes for this slide" value={slide.notes} onChange={(e) => editSlide((s) => ({ ...s, notes: e.target.value }), false)} />
          )}
        </div>
      </div>
      <StatusBar editor={null} zoom={Math.round(scale * 100)} setZoom={(z) => setZoom(Math.max(20, Math.min(300, z)))} message={saver.message} extra={<span className="tabular-nums">Slide {idx + 1} of {deck.slides.length}</span>} />
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/gif,image/bmp,image/webp" hidden onChange={(e) => { addImage(e.target.files?.[0]); e.target.value = ''; }} />
      {present !== null && <Present deck={deck} start={present} onClose={(at) => { setPresent(null); setCur(at); }} />}
    </div>
  );
}
