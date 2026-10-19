import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlignCenter, AlignLeft, AlignRight, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalJustifyStart, ArrowDownAZ, ArrowUpAZ, Baseline, Bold, DollarSign, Grid3x3, Italic, Merge, BarChart3, PaintBucket, Percent, Plus, Redo2, Search, Underline, Undo2, WrapText, X } from 'lucide-react';
import { Grid, editText, type ContextAt, type GridHandle, type Pos, type Sel } from './Grid.tsx';
import { colLeft, extent, key, MIN_COLS, MIN_ROWS, norm, numberOf, parseInput, parseRange, rangeText, rowTop, type Cell, type CellFmt, type Chart, type ChartType, type Edge, type Range, type Sheet, type Workbook } from './model.ts';
import { autofill, setBorders, type BorderMode, clearRange, deleteCols, deleteRows, fill, formatRange, fromTsv, insertCols, insertRows, mergeAt, mergeRange, setMany, setValue, sortRange, stats, toTsv, unmergeRange, allHave } from './ops.ts';
import { formatCell, NUMBER_FORMATS, dateToSerial, changeDecimals } from './format.ts';
import { chartId, currentRegion, guessHeaders } from './charts.ts';
import { findAll, replacedText, replacementValue, type FindOpts } from './find.ts';
import { exportXlsx } from './xlsx.ts';
import { exportCsv } from './csv.ts';
import { MenuBar, type MenuDef, type MenuItem } from '../components/MenuBar.tsx';
import { ContextMenu } from '../components/ContextMenu.tsx';
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
import { importXlsx } from './xlsx.ts';

type Move = 'down' | 'right' | 'up' | 'left' | null;
const DELTA: Record<Exclude<Move, null>, [number, number]> = { down: [1, 0], up: [-1, 0], right: [0, 1], left: [0, -1] };
const sheetBase = 'Sheet';
const BORDER_MODES: [BorderMode, string][] = [['all', 'All borders'], ['outer', 'Outer borders'], ['inner', 'Inner borders'], ['top', 'Top border'], ['bottom', 'Bottom border'], ['left', 'Left border'], ['right', 'Right border'], ['none', 'No borders']];
const BORDER_STYLES: Edge['st'][] = ['thin', 'medium', 'thick', 'dashed', 'dotted', 'double'];
const colLetter = (c: number) => { let n = c + 1, o = ''; while (n > 0) { o = String.fromCharCode(65 + ((n - 1) % 26)) + o; n = Math.floor((n - 1) / 26); } return o; };

/**
 * The spreadsheet editor (the Sheets app): .xlsx and .csv. Basic on purpose: values, text, formats, several sheets, sorting, clipboard, undo. Formulas are kept and
 * written back (with the value the file last had) but not calculated here yet; a formula typed in is saved for Excel or LibreOffice to calculate.
 */
export function SheetPane({ initial, kind, path, name, warnings, csv, onReset }: { initial: Workbook; kind: 'xlsx' | 'csv'; path: string | null; name: string; warnings: string[]; csv?: { crlf: boolean; bom: boolean }; onReset: () => void }) {
  const navigate = useNavigate();
  const h = useHistory(initial);
  const book = h.value;
  const sheet = book.sheets[book.active] ?? book.sheets[0];
  const [zoom, setZoom] = usePref('sheet.zoom', 100);
  const [sel, setSel] = useState<Sel>({ anchor: { r: 0, c: 0 }, focus: { r: 0, c: 0 } });
  const [editing, setEditing] = useState<{ pos: Pos; text: string; typed: boolean } | null>(null);
  const [dirty, setDirtyState] = useState(false);
  const [header, setHeader] = useState(false);
  const [bar, setBar] = useState<string | null>(null);
  const [recent, setRecent] = useState<{ path: string; name: string }[]>([]);
  const [renaming, setRenaming] = useState<number | null>(null);
  const [textColour, setTextColour] = useState('#d9480f');
  const [fillColour, setFillColour] = useState('#fff176');
  const [sizeText, setSizeText] = useState<string | null>(null);
  const [borderColour, setBorderColour] = useState('#000000');
  const [borderStyle, setBorderStyle] = useState<Edge['st']>('thin');
  const [ctx, setCtx] = useState<{ at: { x: number; y: number }; kind: ContextAt['kind'] } | null>(null);
  const [chartSel, setChartSel] = useState<string | null>(null);
  const [chartDlg, setChartDlg] = useState<{ id?: string; type: ChartType; title: string; range: string; header: boolean; labels: boolean; error?: string } | null>(null);
  const [find, setFind] = useState<{ q: string; rep: string; matchCase: boolean; wholeCell: boolean; idx: number } | null>(null);
  const grid = useRef<GridHandle>(null);
  const clip = useRef<{ text: string; cells: Cell[][] } | null>(null);
  const isCsv = kind === 'csv';
  const touchRef = useRef<() => void>(() => undefined);
  const bookRef = useRef(book); bookRef.current = book;

  const commit = useCallback((next: Workbook | ((b: Workbook) => Workbook)) => { h.set(next); setDirty(true); setDirtyState(true); touchRef.current(); }, [h]);
  const edit = (f: (s: Sheet) => Sheet) => commit((b) => ({ ...b, sheets: b.sheets.map((s, i) => (i === b.active ? f(s) : s)) }));

  const ext = useMemo(() => extent(sheet), [sheet]);
  const rows = Math.min(1048576, Math.max(MIN_ROWS, ext.rows + 20, sel.focus.r + 20, sel.anchor.r + 2));
  const cols = Math.min(16384, Math.max(MIN_COLS, ext.cols + 3, sel.focus.c + 3, sel.anchor.c + 2));
  const range = norm(sel.anchor, sel.focus);
  const active = sel.anchor;
  const activeCell = sheet.cells[key(active.r, active.c)];

  const getBytes = async () => (isCsv ? exportCsv(bookRef.current, csv ?? { crlf: false, bom: false }) : await exportXlsx(bookRef.current));
  const saver = useSaver({ path, name, warnings, getBytes });
  const newKey = useRef(`new:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);
  const autosave = useAutosave(saver.path ?? newKey.current, getBytes);
  touchRef.current = autosave.touch;
  const doSave = async (as = false) => { if (editing) finish(editing); if (await saver.save(as)) { setDirtyState(false); autosave.clear(); } };
  useEffect(() => () => setDirty(false), []);
  useEffect(() => { rememberLastFile(saver.path); }, [saver.path]);
  useEffect(() => { void desktop()?.recent().then((r) => setRecent(r.slice(0, 10).map((x) => ({ path: x.path, name: x.path.split(/[\\/]/).pop() ?? x.path })))); }, []);

  const select = (anchor: Pos, focus: Pos = anchor) => { setSel({ anchor, focus }); setBar(null); grid.current?.scrollTo(focus); };
  const clampPos = (p: Pos): Pos => ({ r: Math.max(0, Math.min(1048575, p.r)), c: Math.max(0, Math.min(16383, p.c)) });

  // ---- editing a cell
  const finish = (e: NonNullable<typeof editing>, move: Move = null) => {
    setEditing(null);
    const cell = sheet.cells[key(e.pos.r, e.pos.c)];
    if (e.text !== editText(cell)) {
      edit((s) => typeInto(s, e.pos.r, e.pos.c, e.text));
    }
    if (move) { const [dr, dc] = DELTA[move]; select(clampPos({ r: e.pos.r + dr, c: e.pos.c + dc })); } else setSel((s) => ({ ...s }));
    grid.current?.focus();
  };
  const startEdit = (text?: string) => { const p = active; setEditing({ pos: p, text: text ?? editText(activeCell), typed: text !== undefined }); grid.current?.scrollTo(p); };

  /** what typing `t` into a cell does (a formula, a number, a date, text) */
  const typeInto = (s0: Sheet, r: number, c: number, t: string): Sheet => {
    if (!isCsv && t.startsWith('=') && t.length > 1) return setValue(s0, r, c, null, { f: t.slice(1) });
    let v = parseInput(t, !isCsv), nf: string | undefined;
    if (!isCsv && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())) { const d = new Date(`${v.trim()}T00:00:00Z`); if (!Number.isNaN(d.getTime())) { v = dateToSerial(d); nf = 'yyyy-mm-dd'; } }
    return setValue(s0, r, c, v, nf ? { nf } : undefined);
  };

  // ---- charts
  const CHART_TYPES: [ChartType, string][] = [['column', 'Column'], ['bar', 'Bar'], ['line', 'Line'], ['pie', 'Pie']];
  const openChartDlg = (id?: string) => {
    const ch = id ? sheet.charts?.find((c) => c.id === id) : undefined;
    if (ch) { setChartDlg({ id, type: ch.type, title: ch.title, range: rangeText(ch.range), header: ch.header, labels: ch.labels }); return; }
    const single = range.r1 === range.r2 && range.c1 === range.c2;
    const g = single ? currentRegion(sheet, active) : range;
    setChartDlg({ type: 'column', title: '', range: rangeText(g), ...guessHeaders(sheet, g) });
  };
  const closeChartDlg = () => { setChartDlg(null); setTimeout(() => grid.current?.focus(), 0); };
  const saveChart = () => {
    if (!chartDlg) return;
    const g = parseRange(chartDlg.range.trim());
    if (!g) { setChartDlg({ ...chartDlg, error: 'Type the data as a range such as A1:C6.' }); return; }
    if (chartDlg.id) { edit((s0) => ({ ...s0, charts: (s0.charts ?? []).map((c) => (c.id === chartDlg.id ? { ...c, type: chartDlg.type, title: chartDlg.title, range: g, header: chartDlg.header, labels: chartDlg.labels } : c)) })); closeChartDlg(); return; }
    const ch: Chart = { id: chartId(), type: chartDlg.type, title: chartDlg.title, range: g, header: chartDlg.header, labels: chartDlg.labels, x: Math.round(colLeft(sheet, g.c2 + 1) + 24), y: Math.round(rowTop(sheet, g.r1)), w: 480, h: 300 };
    edit((s0) => ({ ...s0, charts: [...(s0.charts ?? []), ch] })); setChartSel(ch.id); closeChartDlg();
  };
  const deleteChart = (id: string) => { edit((s0) => ({ ...s0, charts: (s0.charts ?? []).filter((c) => c.id !== id) })); setChartSel(null); };
  const moveChart = (id: string, f: { x: number; y: number; w: number; h: number }, first: boolean) => { h.set((b) => ({ ...b, sheets: b.sheets.map((s0, i) => (i === b.active ? { ...s0, charts: (s0.charts ?? []).map((c) => (c.id === id ? { ...c, ...f } : c)) } : s0)) }), first); setDirty(true); setDirtyState(true); touchRef.current(); };

  // ---- find and replace
  const findOpts: FindOpts = { matchCase: find?.matchCase ?? false, wholeCell: find?.wholeCell ?? false };
  const hits = useMemo(() => (find ? findAll(sheet, find.q, findOpts) : []), [sheet, find?.q, find?.matchCase, find?.wholeCell]); // eslint-disable-line react-hooks/exhaustive-deps
  const hitSet = useMemo(() => new Set(hits.map((h2) => key(h2.r, h2.c))), [hits]);
  const hitAt = find && hits.length ? hits[((find.idx % hits.length) + hits.length) % hits.length] : null;
  const gotoHit = (i: number) => { if (!find || !hits.length) return; const n = ((i % hits.length) + hits.length) % hits.length; setFind({ ...find, idx: n }); const p = { r: hits[n].r, c: hits[n].c }; setSel({ anchor: p, focus: p }); setBar(null); grid.current?.scrollTo(p); };
  const replaceOne = () => {
    if (!find || !hitAt) return;
    const t = replacedText(sheet, hitAt, find.q, find.rep, findOpts);
    if (t !== null) edit((s0) => typeInto(s0, hitAt.r, hitAt.c, t));
    setFind({ ...find, idx: find.idx + (t === null ? 1 : 0) });
  };
  const replaceAll = () => {
    if (!find || !hits.length) return;
    let n = 0;
    edit((s0) => { let o = s0; for (const h2 of hits) { const t = replacedText(o, h2, find.q, find.rep, findOpts); if (t !== null) { o = typeInto(o, h2.r, h2.c, t); n++; } } return o; });
    saver.setMessage(n ? `Replaced in ${n} cell${n === 1 ? '' : 's'}` : 'Nothing to replace');
  };
  void replacementValue;

  // ---- clipboard
  const doCopy = (cut: boolean): string | null => {
    const text = toTsv(sheet, range, formatCell);
    const cells: Cell[][] = [];
    for (let r = range.r1; r <= range.r2; r++) { const row: Cell[] = []; for (let c = range.c1; c <= range.c2; c++) row.push(sheet.cells[key(r, c)] ?? { v: null }); cells.push(row); }
    clip.current = { text, cells };
    if (cut) edit((s) => clearRange(s, range));
    return text;
  };
  const doPaste = (text: string) => {
    const at = { r: range.r1, c: range.c1 };
    if (clip.current && clip.current.text === text) { const cells = clip.current.cells; edit((s) => setMany(s, at, cells)); setSel({ anchor: at, focus: { r: at.r + cells.length - 1, c: at.c + (cells[0]?.length ?? 1) - 1 } }); return; }
    const grid2 = fromTsv(text);
    const cells: Cell[][] = grid2.map((r) => r.map((t) => ({ v: parseInput(t, !isCsv) })));
    edit((s) => setMany(s, at, cells));
    setSel({ anchor: at, focus: { r: at.r + cells.length - 1, c: at.c + Math.max(...cells.map((r) => r.length)) - 1 } });
  };
  const menuClip = (name: 'cut' | 'copy' | 'paste') => { grid.current?.focus(); const d = desktop(); if (d) d.editCommand(name); else document.execCommand(name); };

  // ---- structure
  const rowsSel = { from: range.r1, to: range.r2 }, colsSel = { from: range.c1, to: range.c2 };
  const jump = (p: Pos, dr: number, dc: number): Pos => {
    const filled = (r: number, c: number) => { const v = sheet.cells[key(r, c)]?.v; return v !== null && v !== undefined && v !== ''; };
    const maxR = Math.max(ext.rows - 1, p.r), maxC = Math.max(ext.cols - 1, p.c);
    let { r, c } = p;
    const inside = (rr: number, cc: number) => rr >= 0 && cc >= 0 && rr <= maxR && cc <= maxC;
    const next = (rr: number, cc: number) => ({ r: rr + dr, c: cc + dc });
    let n = next(r, c);
    if (!inside(n.r, n.c)) return { r: Math.max(0, Math.min(maxR, n.r)), c: Math.max(0, Math.min(maxC, n.c)) };
    if (filled(r, c) && filled(n.r, n.c)) { while (inside(next(r, c).r, next(r, c).c) && filled(next(r, c).r, next(r, c).c)) { n = next(r, c); r = n.r; c = n.c; } return { r, c }; }
    r = n.r; c = n.c;
    while (!filled(r, c) && inside(next(r, c).r, next(r, c).c)) { n = next(r, c); r = n.r; c = n.c; }
    return { r, c };
  };
  const apply = (patch: Partial<CellFmt>) => edit((s) => formatRange(s, range, patch));
  const edge = (): Edge => ({ st: borderStyle, c: borderColour });
  const borders = (mode: BorderMode) => edit((s) => setBorders(s, range, mode, edge()));
  const decimals = (d: number) => { const nf = changeDecimals(activeCell?.s?.nf, d); apply({ nf: nf ?? undefined }); };
  const freeze = (rows: number, cols: number) => edit((s) => { const o = { ...s }; if (rows > 0 || cols > 0) o.freeze = { rows, cols }; else delete o.freeze; return o; });
  const onFill = (src: Range, to: Range) => { edit((s) => autofill(s, src, to)); setSel({ anchor: { r: to.r1, c: to.c1 }, focus: { r: to.r2, c: to.c2 } }); };
  const toggle = (flag: 'b' | 'i' | 'u') => apply({ [flag]: !allHave(sheet, range, flag) });
  const setNf = (nf: string | null) => apply({ nf: nf ?? undefined });
  const sortBy = (asc: boolean) => {
    const single = range.r1 === range.r2 && range.c1 === range.c2;
    const g: Range = single ? { r1: 0, c1: 0, r2: Math.max(0, ext.rows - 1), c2: Math.max(0, ext.cols - 1) } : range;
    edit((s) => sortRange(s, g, active.c, asc, header));
  };
  const autoFit = (c: number) => {
    let w = 40;
    for (const [k, cell] of Object.entries(sheet.cells)) { const [, cc] = k.split(',').map(Number); if (cc === c) w = Math.max(w, formatCell(cell).split('\n').reduce((m, l) => Math.max(m, l.length), 0) * 8 + 16); }
    edit((s) => ({ ...s, colW: { ...s.colW, [c]: Math.min(500, w) } }));
  };
  const addSheet = () => { let n = book.sheets.length + 1; while (book.sheets.some((s) => s.name === `${sheetBase}${n}`)) n++; commit((b) => ({ ...b, sheets: [...b.sheets, { name: `${sheetBase}${n}`, cells: {}, colW: {}, rowH: {}, merges: [] }], active: b.sheets.length })); select({ r: 0, c: 0 }); };
  const removeSheet = (i: number) => { if (book.sheets.length < 2 || !window.confirm(`Delete the sheet “${book.sheets[i].name}”?`)) return; commit((b) => ({ ...b, sheets: b.sheets.filter((_, j) => j !== i), active: Math.max(0, Math.min(b.active, b.sheets.length - 2)) })); };
  const renameSheet = (i: number, to: string) => { const t = to.trim().replace(/[\\/?*[\]:]/g, '').slice(0, 31); if (t && !book.sheets.some((s, j) => j !== i && s.name.toLowerCase() === t.toLowerCase())) commit((b) => ({ ...b, sheets: b.sheets.map((s, j) => (j === i ? { ...s, name: t } : s)) })); setRenaming(null); };
  const showSheet = (i: number) => { if (editing) finish(editing); setChartSel(null); h.set((b) => ({ ...b, active: i }), false); select({ r: 0, c: 0 }); };

  // ---- keyboard
  const onKey = (e: React.KeyboardEvent): boolean => {
    const mod = e.ctrlKey || e.metaKey, k = e.key;
    const extendOrMove = (to: Pos) => { const p = clampPos(to); if (e.shiftKey) select(sel.anchor, p); else select(p); };
    const f = sel.focus;
    if (chartSel && (k === 'Delete' || k === 'Backspace')) { deleteChart(chartSel); return true; }
    if (chartSel && k === 'Escape') { setChartSel(null); return true; }
    if (mod && !e.altKey) {
      const l = k.toLowerCase();
      if (l === 's') { void doSave(e.shiftKey); return true; }
      if (l === 'f' || l === 'h') { setFind((f0) => f0 ?? { q: '', rep: '', matchCase: false, wholeCell: false, idx: 0 }); return true; }
      if (l === 'z') { if (e.shiftKey) h.redo(); else h.undo(); setDirty(true); setDirtyState(true); return true; }
      if (l === 'y') { h.redo(); return true; }
      if (l === 'b') { toggle('b'); return true; } if (l === 'i') { toggle('i'); return true; } if (l === 'u') { toggle('u'); return true; }
      if (l === 'a') { setSel({ anchor: { r: 0, c: 0 }, focus: { r: Math.max(0, ext.rows - 1), c: Math.max(0, ext.cols - 1) } }); return true; }
      if (l === 'd') { edit((s) => fill(s, range, 'down')); return true; }
      if (l === 'r') { edit((s) => fill(s, range, 'right')); return true; }
      if (k.startsWith('Arrow')) { const [dr, dc] = k === 'ArrowDown' ? [1, 0] : k === 'ArrowUp' ? [-1, 0] : k === 'ArrowRight' ? [0, 1] : [0, -1]; extendOrMove(jump(f, dr, dc)); return true; }
      if (k === 'Home') { extendOrMove({ r: 0, c: 0 }); return true; }
      if (k === 'End') { extendOrMove({ r: Math.max(0, ext.rows - 1), c: Math.max(0, ext.cols - 1) }); return true; }
      return false; // copy, cut and paste are the browser's events
    }
    if (k.startsWith('Arrow')) { const [dr, dc] = k === 'ArrowDown' ? [1, 0] : k === 'ArrowUp' ? [-1, 0] : k === 'ArrowRight' ? [0, 1] : [0, -1]; extendOrMove({ r: f.r + dr, c: f.c + dc }); return true; }
    if (k === 'Tab') { select(clampPos({ r: active.r, c: active.c + (e.shiftKey ? -1 : 1) })); return true; }
    if (k === 'Enter') { if (range.r1 !== range.r2 || range.c1 !== range.c2) { const n = { r: active.r + (e.shiftKey ? -1 : 1), c: active.c }; if (n.r > range.r2) { n.r = range.r1; n.c = active.c + 1 > range.c2 ? range.c1 : active.c + 1; } if (n.r < range.r1) n.r = range.r2; setSel({ anchor: n, focus: n }); } else startEdit(); return true; }
    if (k === 'F2') { startEdit(); return true; }
    if (k === 'Delete' || k === 'Backspace') { edit((s) => clearRange(s, range)); return true; }
    if (k === 'Escape') { setBar(null); return true; }
    if (k === 'PageDown' || k === 'PageUp') { extendOrMove({ r: f.r + (k === 'PageDown' ? 20 : -20), c: f.c }); return true; }
    if (k === 'Home') { extendOrMove({ r: f.r, c: 0 }); return true; }
    if (k.length === 1 && !e.altKey) { startEdit(k); return true; }
    return false;
  };

  // ---- the file menu's extras
  const saveCopy = async (as: 'xlsx' | 'csv') => {
    const d = desktop(); if (!d) return;
    const base = (saver.name || name).replace(/\.[^.]+$/, '');
    const target = await d.saveDialog(`${base}.${as}`, docPrefs().defaultDir || undefined);
    if (!target) return;
    try { await d.writeFile(target, as === 'csv' ? exportCsv(book, csv ?? { crlf: false, bom: false }) : await exportXlsx(book)); saver.setMessage(`Saved a copy as ${target.split(/[\\/]/).pop()}${as === 'csv' ? ' (this sheet only)' : ''}`); } catch (er) { saver.setMessage(`Could not save: ${(er as Error).message}`); }
  };
  const reset = () => { if (docPrefs().confirmReset && !window.confirm('Throw away the changes made since the file was opened (or last saved)?')) return; autosave.clear(); setDirty(false); onReset(); };
  const openRecent = (p: string) => { if (!confirmLeave()) return; void desktop()?.openRecent(p).then((r) => { addOpened(r); navigate(editUrl(r.path)); }); };
  const restore = async () => {
    if (!autosave.found) return;
    try { const f = autosave.found.bytes; const r = isCsv ? null : await importXlsx(f); if (r) h.set(r.book); else { const { importCsv } = await import('./csv.ts'); h.set(importCsv(f).book); } setDirty(true); setDirtyState(true); saver.setMessage('Restored the backed-up changes'); } catch { saver.setMessage('The backup could not be read'); }
    autosave.dismiss();
  };

  const sep: MenuItem = { sep: true };
  const nfItems: MenuItem[] = NUMBER_FORMATS.map((n) => ({ label: n.label, check: (activeCell?.s?.nf ?? null) === n.code, run: () => setNf(n.code) }));
  const menus: MenuDef[] = [
    { label: 'File', items: [
      { label: 'Home', keys: 'Ctrl+Alt+H', run: () => goHome(navigate) }, sep,
      { label: 'New spreadsheet', keys: 'Ctrl+N', run: () => goNew(navigate, 'xlsx') }, { label: 'Open…', keys: 'Ctrl+O', run: () => openFileDialog(navigate) },
      { label: 'Open recent', disabled: recent.length === 0, sub: recent.map((r) => ({ label: r.name, run: () => openRecent(r.path) })) }, sep,
      { label: 'Save', keys: 'Ctrl+S', run: () => void doSave() }, { label: 'Save as…', keys: 'Ctrl+Shift+S', run: () => void doSave(true) },
      isCsv ? { label: 'Save a copy as .xlsx…', run: () => void saveCopy('xlsx') } : { label: 'Save this sheet as .csv…', run: () => void saveCopy('csv') },
      { label: 'Reset session edits', run: reset }, sep, { label: 'Quit', keys: 'Ctrl+Q', run: () => desktop()?.windowControl?.('close') },
    ] },
    { label: 'Edit', items: [
      { label: 'Undo', keys: 'Ctrl+Z', disabled: !h.canUndo, run: h.undo }, { label: 'Redo', keys: 'Ctrl+Shift+Z', disabled: !h.canRedo, run: h.redo }, sep,
      { label: 'Cut', keys: 'Ctrl+X', run: () => menuClip('cut') }, { label: 'Copy', keys: 'Ctrl+C', run: () => menuClip('copy') }, { label: 'Paste', keys: 'Ctrl+V', run: () => menuClip('paste') }, sep,
      { label: 'Clear values', keys: 'Delete', run: () => edit((s) => clearRange(s, range)) }, { label: 'Clear values and formats', run: () => edit((s) => clearRange(s, range, true)) }, sep,
      { label: 'Find and replace…', keys: 'Ctrl+F', run: () => setFind((f0) => f0 ?? { q: '', rep: '', matchCase: false, wholeCell: false, idx: 0 }) }, sep,
      { label: 'Fill down', keys: 'Ctrl+D', run: () => edit((s) => fill(s, range, 'down')) }, { label: 'Fill right', keys: 'Ctrl+R', run: () => edit((s) => fill(s, range, 'right')) }, { label: 'Select all', keys: 'Ctrl+A', run: () => setSel({ anchor: { r: 0, c: 0 }, focus: { r: Math.max(0, ext.rows - 1), c: Math.max(0, ext.cols - 1) } }) },
    ] },
    { label: 'View', items: [...(isCsv ? [] : [{ label: 'Freeze', sub: [
      { label: 'No frozen rows or columns', check: !sheet.freeze, run: () => freeze(0, 0) }, sep,
      { label: '1 row', check: sheet.freeze?.rows === 1 && !sheet.freeze.cols, run: () => freeze(1, 0) }, { label: '2 rows', check: sheet.freeze?.rows === 2 && !sheet.freeze.cols, run: () => freeze(2, 0) }, { label: `Up to row ${active.r + 1}`, run: () => freeze(active.r + 1, sheet.freeze?.cols ?? 0) }, sep,
      { label: '1 column', check: sheet.freeze?.cols === 1 && !sheet.freeze.rows, run: () => freeze(0, 1) }, { label: '2 columns', check: sheet.freeze?.cols === 2 && !sheet.freeze.rows, run: () => freeze(0, 2) }, { label: `Up to column ${colLetter(active.c)}`, run: () => freeze(sheet.freeze?.rows ?? 0, active.c + 1) },
    ] } as MenuItem, sep]), { label: 'Zoom in', run: () => setZoom(Math.min(300, zoom + 10)) }, { label: 'Zoom out', run: () => setZoom(Math.max(50, zoom - 10)) }, { label: 'Reset zoom', run: () => setZoom(100) }, sep, { label: 'Full screen', keys: 'F11', run: () => desktop()?.windowControl?.('fullscreen') }] },
    { label: 'Insert', items: [
      { label: 'Row above', run: () => { edit((s) => insertRows(s, range.r1, range.r2 - range.r1 + 1)); } }, { label: 'Row below', run: () => { edit((s) => insertRows(s, range.r2 + 1, range.r2 - range.r1 + 1)); } },
      { label: 'Column left', run: () => { edit((s) => insertCols(s, range.c1, range.c2 - range.c1 + 1)); } }, { label: 'Column right', run: () => { edit((s) => insertCols(s, range.c2 + 1, range.c2 - range.c1 + 1)); } }, sep,
      ...(isCsv ? [] : [{ label: 'Chart…', run: () => openChartDlg() } as MenuItem, ...(chartSel ? [{ label: 'Edit the selected chart…', run: () => openChartDlg(chartSel) } as MenuItem, { label: 'Delete the selected chart', run: () => deleteChart(chartSel) } as MenuItem] : []), sep]),
      { label: 'Delete row(s)', run: () => edit((s) => deleteRows(s, rowsSel.from, rowsSel.to)) }, { label: 'Delete column(s)', run: () => edit((s) => deleteCols(s, colsSel.from, colsSel.to)) }, ...(isCsv ? [] : [sep, { label: 'New sheet', run: addSheet } as MenuItem]),
    ] },
    { label: 'Format', items: [
      { label: 'Bold', keys: 'Ctrl+B', check: allHave(sheet, range, 'b'), run: () => toggle('b') }, { label: 'Italic', keys: 'Ctrl+I', check: allHave(sheet, range, 'i'), run: () => toggle('i') }, { label: 'Underline', keys: 'Ctrl+U', check: allHave(sheet, range, 'u'), run: () => toggle('u') }, sep,
      { label: 'Align left', run: () => apply({ align: 'left' }) }, { label: 'Align centre', run: () => apply({ align: 'center' }) }, { label: 'Align right', run: () => apply({ align: 'right' }) }, { label: 'Wrap text', check: !!activeCell?.s?.wrap, run: () => apply({ wrap: !activeCell?.s?.wrap }) }, sep,
      { label: 'Number format', sub: nfItems }, { label: 'More decimal places', run: () => decimals(1) }, { label: 'Fewer decimal places', run: () => decimals(-1) }, sep,
      { label: 'Vertical align', sub: (['top', 'middle', 'bottom'] as const).map((v): MenuItem => ({ label: v[0].toUpperCase() + v.slice(1), check: activeCell?.s?.va === v, run: () => apply({ va: v }) })) },
      { label: 'Borders', sub: BORDER_MODES.map(([m, l]): MenuItem => ({ label: l, run: () => borders(m) })) }, sep,
      { label: 'Merge cells', run: () => edit((s) => mergeRange(s, range)) }, { label: 'Unmerge cells', run: () => edit((s) => unmergeRange(s, range)) }, sep,
      { label: 'Fit column width to the text', run: () => { for (let c = range.c1; c <= range.c2; c++) autoFit(c); } }, { label: 'Clear formatting', run: () => edit((s) => { let o = s; for (let r = range.r1; r <= range.r2; r++) for (let c = range.c1; c <= range.c2; c++) { const cell = o.cells[key(r, c)]; if (cell?.s) o = setMany(o, { r, c }, [[{ ...cell, s: undefined }]]); } return o; }) },
    ] },
    { label: 'Data', items: [
      { label: 'Sort A → Z by this column', run: () => sortBy(true) }, { label: 'Sort Z → A by this column', run: () => sortBy(false) }, { label: 'The first row is a header', check: header, run: () => setHeader(!header) },
    ] },
  ];

  const ctxItems = (kind: ContextAt['kind']): MenuItem[] => {
    const rowsN = range.r2 - range.r1 + 1, colsN = range.c2 - range.c1 + 1;
    const rowItems: MenuItem[] = [{ label: `Insert ${rowsN} row${rowsN > 1 ? 's' : ''} above`, run: () => edit((s0) => insertRows(s0, range.r1, rowsN)) }, { label: `Insert ${rowsN} row${rowsN > 1 ? 's' : ''} below`, run: () => edit((s0) => insertRows(s0, range.r2 + 1, rowsN)) }, { label: `Delete row${rowsN > 1 ? 's' : ''}`, run: () => edit((s0) => deleteRows(s0, rowsSel.from, rowsSel.to)) }];
    const colItems: MenuItem[] = [{ label: `Insert ${colsN} column${colsN > 1 ? 's' : ''} left`, run: () => edit((s0) => insertCols(s0, range.c1, colsN)) }, { label: `Insert ${colsN} column${colsN > 1 ? 's' : ''} right`, run: () => edit((s0) => insertCols(s0, range.c2 + 1, colsN)) }, { label: `Delete column${colsN > 1 ? 's' : ''}`, run: () => edit((s0) => deleteCols(s0, colsSel.from, colsSel.to)) }];
    const clipItems: MenuItem[] = [{ label: 'Cut', keys: 'Ctrl+X', run: () => menuClip('cut') }, { label: 'Copy', keys: 'Ctrl+C', run: () => menuClip('copy') }, { label: 'Paste', keys: 'Ctrl+V', run: () => menuClip('paste') }];
    const frozen: MenuItem[] = isCsv ? [] : [sep, { label: `Freeze up to row ${active.r + 1}`, run: () => freeze(active.r + 1, sheet.freeze?.cols ?? 0) }, { label: `Freeze up to column ${colLetter(active.c)}`, run: () => freeze(sheet.freeze?.rows ?? 0, active.c + 1) }, { label: 'Unfreeze', disabled: !sheet.freeze, run: () => freeze(0, 0) }];
    const clear: MenuItem = { label: 'Clear values', keys: 'Delete', run: () => edit((s0) => clearRange(s0, range)) };
    if (kind === 'col') return [...clipItems, sep, ...colItems, sep, clear, { label: 'Sort A → Z', run: () => sortBy(true) }, { label: 'Sort Z → A', run: () => sortBy(false) }, { label: 'Fit width to the text', run: () => { for (let c = range.c1; c <= range.c2; c++) autoFit(c); } }, ...frozen];
    if (kind === 'row') return [...clipItems, sep, ...rowItems, sep, clear, ...frozen];
    return [...clipItems, sep, ...rowItems, ...colItems, sep, clear, { label: 'Clear values and formats', run: () => edit((s0) => clearRange(s0, range, true)) }, { label: 'Merge cells', disabled: range.r1 === range.r2 && range.c1 === range.c2, run: () => edit((s0) => mergeRange(s0, range)) }, sep, { label: 'Sort A → Z by this column', run: () => sortBy(true) }, { label: 'Sort Z → A by this column', run: () => sortBy(false) }, ...frozen];
  };
  const st = useMemo(() => (range.r1 === range.r2 && range.c1 === range.c2 ? null : stats(sheet, range)), [sheet, range.r1, range.r2, range.c1, range.c2]); // eslint-disable-line react-hooks/exhaustive-deps
  const num = (n: number) => String(Number(n.toPrecision(10)));
  const barText = bar ?? editText(activeCell);
  const size = activeCell?.s?.size ?? 11;
  const merged = !!mergeAt(sheet, active.r, active.c);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <MenuBar menus={menus} label="Spreadsheet menu" />
      <DocHeader name={saver.name} path={saver.path} dirty={dirty} busy={saver.busy} onSave={() => void doSave()} onSaveAs={() => void doSave(true)} />
      {autosave.found && (
        <div role="alert" className="tk-expand mx-3 mb-2 flex flex-wrap items-center gap-2 rounded-theme border border-accent bg-accent/10 px-3 py-2 text-sm">
          <span className="flex-1">Unsaved changes from {new Date(autosave.found.at).toLocaleString()} were backed up. Restore them?</span>
          <button className="btn btn-accent text-sm" onClick={() => void restore()}>Restore</button><button className="btn text-sm" onClick={() => { autosave.clear(); autosave.dismiss(); }}>Discard</button>
        </div>
      )}
      {warnings.length > 0 && (
        <div role="alert" className="mx-3 mb-2 rounded-theme border border-warn bg-warn/10 px-3 py-2 text-sm">
          <b>Parts of this workbook cannot be edited here:</b> {warnings.join(' ')} <span className="text-muted">Saving writes a new file without them (a copy of the original is kept); use Save as to keep the original untouched.</span>
        </div>
      )}
      <div role="toolbar" aria-label="Formatting" className="tb-bar bt-top flex flex-wrap items-center gap-px px-2 py-1">
        <Btn label="Undo (Ctrl+Z)" onClick={h.undo} disabled={!h.canUndo}><Undo2 size={16} /></Btn>
        <Btn label="Redo (Ctrl+Shift+Z)" onClick={h.redo} disabled={!h.canRedo}><Redo2 size={16} /></Btn>
        <Sep />
        <FontBox value={activeCell?.s?.font ?? 'Calibri'} onPick={(f) => apply({ font: f })} />
        <input aria-label="Font size" list="sheet-font-sizes" className="input !w-14 !px-1 !py-1 text-center text-sm" inputMode="decimal" value={sizeText ?? String(size)}
          onFocus={(e) => e.currentTarget.select()} onChange={(e) => setSizeText(e.target.value)} onBlur={() => { const n = Number((sizeText ?? '').replace(',', '.')); if (n >= 1 && n <= 400) apply({ size: n }); setSizeText(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); grid.current?.focus(); } }} />
        <datalist id="sheet-font-sizes">{SIZES.map((z) => <option key={z} value={z} />)}</datalist>
        <Sep />
        <Btn label="Bold (Ctrl+B)" active={allHave(sheet, range, 'b')} onClick={() => toggle('b')}><Bold size={16} /></Btn>
        <Btn label="Italic (Ctrl+I)" active={allHave(sheet, range, 'i')} onClick={() => toggle('i')}><Italic size={16} /></Btn>
        <Btn label="Underline (Ctrl+U)" active={allHave(sheet, range, 'u')} onClick={() => toggle('u')}><Underline size={16} /></Btn>
        <SplitColour label="Text colour" icon={<Baseline size={15} />} last={textColour} onApply={(c) => apply({ color: c })} onPick={(c) => { setTextColour(c); apply({ color: c }); }} />
        <SplitColour label="Fill colour" icon={<PaintBucket size={15} />} last={fillColour} onApply={(c) => apply({ fill: c })} onPick={(c) => { setFillColour(c); apply({ fill: c }); }} />
        <Sep />
        <Btn label="Align top" active={activeCell?.s?.va === 'top'} onClick={() => apply({ va: 'top' })}><AlignVerticalJustifyStart size={16} /></Btn>
        <Btn label="Align middle" active={activeCell?.s?.va === 'middle'} onClick={() => apply({ va: 'middle' })}><AlignVerticalJustifyCenter size={16} /></Btn>
        <Btn label="Align bottom" active={activeCell?.s?.va === 'bottom'} onClick={() => apply({ va: 'bottom' })}><AlignVerticalJustifyEnd size={16} /></Btn>
        <Btn label="Align left" active={activeCell?.s?.align === 'left'} onClick={() => apply({ align: 'left' })}><AlignLeft size={16} /></Btn>
        <Btn label="Align centre" active={activeCell?.s?.align === 'center'} onClick={() => apply({ align: 'center' })}><AlignCenter size={16} /></Btn>
        <Btn label="Align right" active={activeCell?.s?.align === 'right'} onClick={() => apply({ align: 'right' })}><AlignRight size={16} /></Btn>
        <Btn label="Wrap text" active={!!activeCell?.s?.wrap} onClick={() => apply({ wrap: !activeCell?.s?.wrap })}><WrapText size={16} /></Btn>
        <Btn label={merged ? 'Unmerge cells' : 'Merge cells'} active={merged} onClick={() => edit((s) => (merged ? unmergeRange(s, range) : mergeRange(s, range)))}><Merge size={16} /></Btn>
        <Sep />
        <select aria-label="Borders" className="input !w-20 !px-1 !py-1 text-sm" value="" title="Borders (uses the style and colour beside it)" onChange={(e) => { if (e.target.value) borders(e.target.value as BorderMode); e.target.value = ''; }}>
          <option value="">▦ Borders</option>{BORDER_MODES.map(([m, l]) => <option key={m} value={m}>{l}</option>)}
        </select>
        <select aria-label="Border style" className="input !w-20 !px-1 !py-1 text-sm" value={borderStyle} onChange={(e) => setBorderStyle(e.target.value as Edge['st'])}>{BORDER_STYLES.map((b) => <option key={b} value={b}>{b}</option>)}</select>
        <SplitColour label="Border colour" icon={<Grid3x3 size={15} />} last={borderColour} onApply={(c) => setBorderColour(c)} onPick={(c) => setBorderColour(c)} />
        <Sep />
        <Btn label="Format as currency" onClick={() => apply({ nf: '"$"#,##0.00' })}><DollarSign size={16} /></Btn>
        <Btn label="Format as percent" onClick={() => apply({ nf: '0%' })}><Percent size={16} /></Btn>
        <Btn label="Fewer decimal places" onClick={() => decimals(-1)}><span className="text-xs tabular-nums">.0←</span></Btn>
        <Btn label="More decimal places" onClick={() => decimals(1)}><span className="text-xs tabular-nums">.00→</span></Btn>
        <select aria-label="Number format" className="input !w-44 !py-1 text-sm" value={NUMBER_FORMATS.find((n) => n.code === (activeCell?.s?.nf ?? null))?.label ?? 'Automatic'} onChange={(e) => setNf(NUMBER_FORMATS.find((n) => n.label === e.target.value)?.code ?? null)}>
          {NUMBER_FORMATS.map((n) => <option key={n.label}>{n.label}</option>)}
        </select>
        <Sep />
        {!isCsv && <Btn label="Insert chart" onClick={() => openChartDlg()}><BarChart3 size={16} /></Btn>}
        <Btn label="Sort A to Z by this column" onClick={() => sortBy(true)}><ArrowDownAZ size={16} /></Btn>
        <Btn label="Sort Z to A by this column" onClick={() => sortBy(false)}><ArrowUpAZ size={16} /></Btn>
      </div>
      <div className="flex items-center gap-2 border-b border-line px-2 py-1 text-sm">
        <span className="w-20 shrink-0 rounded-theme bg-raised px-2 py-0.5 text-center text-xs tabular-nums" aria-label="Selection">{rangeText(range)}</span>
        <span className="text-muted">ƒ</span>
        <input aria-label="Formula bar" className="input !py-0.5 text-sm" value={barText} onFocus={() => setBar(editText(activeCell))} onChange={(e) => setBar(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); finish({ pos: active, text: barText, typed: false }, 'down'); setBar(null); } else if (e.key === 'Escape') { setBar(null); grid.current?.focus(); } }} onBlur={() => setBar(null)} />
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <Grid ref={grid} sheet={sheet} rows={rows} cols={cols} zoom={zoom} sel={sel} onSel={(s) => { setSel(s); setBar(null); }} editing={editing} setEditing={setEditing} onCommit={(p, t, m) => finish({ pos: p, text: t, typed: false }, m)}
          onKey={onKey} onResize={(kind, i, size) => edit((s) => (kind === 'col' ? { ...s, colW: { ...s.colW, [i]: size } } : { ...s, rowH: { ...s.rowH, [i]: size } }))} onCopy={doCopy} onPaste={doPaste}
          chartSel={chartSel} onChartSel={setChartSel} onChartMove={moveChart} onChartEdit={openChartDlg} onFill={onFill} onContext={(c) => setCtx({ at: { x: c.x, y: c.y }, kind: c.kind })} hits={find ? hitSet : undefined} hitNow={hitAt ? key(hitAt.r, hitAt.c) : null} />
        {find && (
          <div role="search" aria-label="Find and replace" className="bt-window tk-pop absolute right-5 top-2 z-20 w-72 p-2 text-sm shadow-lg">
            <div className="mb-1 flex items-center gap-1">
              <Search size={14} className="text-muted" />
              <input autoFocus aria-label="Find" className="input !py-0.5 text-sm" placeholder="Find" value={find.q} onChange={(e) => setFind({ ...find, q: e.target.value, idx: 0 })}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); gotoHit(find.idx + (e.shiftKey ? -1 : 1)); } else if (e.key === 'Escape') { e.stopPropagation(); setFind(null); grid.current?.focus(); } }} />
              <button type="button" className="btn btn-ghost !px-1" aria-label="Close find" onClick={() => { setFind(null); grid.current?.focus(); }}><X size={14} /></button>
            </div>
            <input aria-label="Replace with" className="input mb-1 !py-0.5 text-sm" placeholder="Replace with" value={find.rep} onChange={(e) => setFind({ ...find, rep: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); replaceOne(); } else if (e.key === 'Escape') { e.stopPropagation(); setFind(null); grid.current?.focus(); } }} />
            <div className="mb-1 flex flex-wrap items-center gap-x-3 text-xs">
              <label className="flex items-center gap-1"><input type="checkbox" checked={find.matchCase} onChange={(e) => setFind({ ...find, matchCase: e.target.checked, idx: 0 })} />Match case</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={find.wholeCell} onChange={(e) => setFind({ ...find, wholeCell: e.target.checked, idx: 0 })} />Whole cell</label>
              <span className="ml-auto tabular-nums text-muted" aria-live="polite">{find.q ? (hits.length ? `${(((find.idx % hits.length) + hits.length) % hits.length) + 1} of ${hits.length}` : 'No matches') : ''}</span>
            </div>
            <div className="flex gap-1">
              <button type="button" className="btn text-xs" disabled={!hits.length} onClick={() => gotoHit(find.idx - 1)}>Previous</button>
              <button type="button" className="btn text-xs" disabled={!hits.length} onClick={() => gotoHit(find.idx + 1)}>Next</button>
              <button type="button" className="btn text-xs" disabled={!hits.length} onClick={replaceOne}>Replace</button>
              <button type="button" className="btn text-xs" disabled={!hits.length} onClick={replaceAll}>Replace all</button>
            </div>
          </div>
        )}
      </div>
      {chartDlg && (
        <Dialog title={chartDlg.id ? 'Edit chart' : 'Insert chart'} onClose={() => closeChartDlg()} footer={<>
          {chartDlg.id && <button className="btn mr-auto" onClick={() => { deleteChart(chartDlg.id!); closeChartDlg(); }}>Delete chart</button>}
          <button className="btn" onClick={() => closeChartDlg()}>Cancel</button><button className="btn btn-accent" onClick={saveChart}>{chartDlg.id ? 'Update' : 'Insert'}</button></>}>
          <div className="grid gap-3 text-sm">
            <label className="grid gap-1">Chart type
              <select aria-label="Chart type" className="input" value={chartDlg.type} onChange={(e) => setChartDlg({ ...chartDlg, type: e.target.value as ChartType })}>{CHART_TYPES.map(([t, l]) => <option key={t} value={t}>{l}</option>)}</select></label>
            <label className="grid gap-1">Title <input aria-label="Chart title" className="input" value={chartDlg.title} onChange={(e) => setChartDlg({ ...chartDlg, title: e.target.value })} /></label>
            <label className="grid gap-1">Data range <input aria-label="Data range" className="input" value={chartDlg.range} onChange={(e) => setChartDlg({ ...chartDlg, range: e.target.value, error: undefined })} /></label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1"><input type="checkbox" checked={chartDlg.header} onChange={(e) => setChartDlg({ ...chartDlg, header: e.target.checked })} />First row has the series names</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={chartDlg.labels} onChange={(e) => setChartDlg({ ...chartDlg, labels: e.target.checked })} />First column has the labels</label>
            </div>
            {chartDlg.error && <p role="alert" className="text-bad">{chartDlg.error}</p>}
          </div>
        </Dialog>
      )}
      {ctx && <ContextMenu at={ctx.at} items={ctxItems(ctx.kind)} onClose={() => { setCtx(null); grid.current?.focus(); }} />}
      <div className="bt-footer flex items-stretch overflow-x-auto border-t border-line" role="tablist" aria-label="Sheets">
        {book.sheets.map((s, i) => renaming === i
          ? <input key={i} autoFocus className="input !w-32 !py-0.5 text-sm" defaultValue={s.name} aria-label="Sheet name" onBlur={(e) => renameSheet(i, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setRenaming(null); }} />
          : <button key={i} role="tab" aria-selected={i === book.active} className="sheet-tab" onClick={() => showSheet(i)} onDoubleClick={() => !isCsv && setRenaming(i)} onContextMenu={(e) => { e.preventDefault(); removeSheet(i); }} title={isCsv ? s.name : 'Double-click to rename, right-click to delete'}>{s.name}</button>)}
        {!isCsv && <button type="button" className="btn btn-ghost !px-2 !py-0.5" aria-label="Add sheet" title="Add sheet" onClick={addSheet}><Plus size={14} /></button>}
        <span className="flex-1" />
        <span className="self-center px-3 text-xs text-muted">Formulas are kept, not calculated yet</span>
      </div>
      <StatusBar editor={null} zoom={zoom} setZoom={(z) => setZoom(Math.min(300, Math.max(50, z)))} message={saver.message}
        extra={st ? <span className="tabular-nums">Sum {num(st.sum)} · Average {num(st.avg)} · Count {st.count}</span> : undefined} />
    </div>
  );
}
