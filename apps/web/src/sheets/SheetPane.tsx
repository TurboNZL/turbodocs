import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlignCenter, AlignLeft, AlignRight, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalJustifyStart, ArrowDownAZ, ArrowUpAZ, Baseline, Bold, DollarSign, Grid3x3, Italic, Merge, BarChart3, PaintBucket, Filter, Link2, Paintbrush, Percent, Plus, Redo2, Search, Strikethrough, Underline, Undo2, WrapText, X } from 'lucide-react';
import { Grid, editText, type ContextAt, type GridHandle, type Pos, type Sel } from './Grid.tsx';
import { colLeft, extent, key, MIN_COLS, MIN_ROWS, norm, numberOf, parseInput, parseRange, rangeText, rowTop, type Cell, type CellFmt, type CfRule, type Chart, type ChartType, type Edge, type Range, type Sheet, type Validation, type Workbook } from './model.ts';
import { autofill, pasteFormats, setFormat, valuesOf, setLink, shiftFormula, setBorders, type BorderMode, clearRange, deleteCols, deleteRows, fill, formatRange, fromTsv, insertCols, insertRows, mergeAt, mergeRange, setMany, setValue, sortRange, stats, toTsv, unmergeRange, allHave } from './ops.ts';
import { formatCell, NUMBER_FORMATS, dateToSerial, changeDecimals } from './format.ts';
import { chartId, currentRegion, guessHeaders } from './charts.ts';
import { cfEvaluator, CF_KINDS, columnValues, hiddenRows, listItems, validate, validationAt } from './rules.ts';
import { findAll, replacedText, replacementValue, type FindOpts } from './find.ts';
import { exportXlsx } from './xlsx.ts';
import { exportCsv } from './csv.ts';
import { MenuBar, type MenuDef, type MenuItem } from '../components/MenuBar.tsx';
import { ContextMenu } from '../components/ContextMenu.tsx';
import { Dialog } from '../components/Dialog.tsx';
import { FontBox } from '../components/FontBox.tsx';
import { Select } from '../components/Select.tsx';
import { OverflowBar } from '../components/OverflowBar.tsx';
import { ColourField } from '../components/ColourField.tsx';
import { SizeBox } from '../components/SizeBox.tsx';
import { Btn, Sep, SplitColour } from '../editor/Toolbar.tsx';
import { StatusBar } from '../editor/StatusBar.tsx';
import { DocActions, DocTitle } from '../editor/DocHeader.tsx';
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
  const [linkDlg, setLinkDlg] = useState<{ url: string } | null>(null);
  const [cfDlg, setCfDlg] = useState<{ range: string; kind: CfRule['kind']; v1: string; v2: string; fill: string; color: string; bold: boolean; lo: string; hi: string; error?: string } | null>(null);
  const [dvDlg, setDvDlg] = useState<{ range: string; kind: 'list' | 'source' | 'whole' | 'decimal'; items: string; source: string; min: string; max: string; blank: boolean; message: string; error?: string } | null>(null);
  const [filterDlg, setFilterDlg] = useState<{ col: number; off: Set<string> } | null>(null);
  const [listMenu, setListMenu] = useState<{ at: { x: number; y: number }; r: number; c: number } | null>(null);
  const [tabMenu, setTabMenu] = useState<{ at: { x: number; y: number }; i: number } | null>(null);
  const [painting, setPainting] = useState(false);
  const pasteMode = useRef<'values' | 'format' | null>(null);
  const paintRef = useRef<{ fmt: CellFmt | undefined; last: Sel | null } | null>(null);
  const [chartSel, setChartSel] = useState<string | null>(null);
  const [chartDlg, setChartDlg] = useState<{ id?: string; type: ChartType; title: string; range: string; header: boolean; labels: boolean; error?: string } | null>(null);
  const [find, setFind] = useState<{ q: string; rep: string; matchCase: boolean; wholeCell: boolean; idx: number } | null>(null);
  const grid = useRef<GridHandle>(null);
  const clip = useRef<{ text: string; cells: Cell[][]; from: { r: number; c: number } } | null>(null);
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
      const bad = validate(sheet, e.pos.r, e.pos.c, e.text);
      if (bad) saver.setMessage(bad); else edit((s) => typeInto(s, e.pos.r, e.pos.c, e.text));
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

  // ---- links, rules, filters
  const cfEval = useMemo(() => cfEvaluator(sheet), [sheet.cf, sheet.cells]); // eslint-disable-line react-hooks/exhaustive-deps
  const hidden = useMemo(() => hiddenRows(sheet), [sheet.filter, sheet.cells]); // eslint-disable-line react-hooks/exhaustive-deps
  const openLink = (url: string) => { window.open(url, '_blank', 'noopener'); };
  const openLinkDlg = () => setLinkDlg({ url: activeCell?.link ?? '' });
  const saveLink = () => {
    if (!linkDlg) return;
    let u = linkDlg.url.trim();
    if (u && !/^(https?:|mailto:)/i.test(u)) u = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(u) ? `mailto:${u}` : `https://${u}`;
    edit((s0) => setLink(s0, range, u || undefined)); setLinkDlg(null); grid.current?.focus();
  };
  const regionOrRange = (): Range => (range.r1 === range.r2 && range.c1 === range.c2 ? currentRegion(sheet, active) : range);
  const openCfDlg = () => setCfDlg({ range: rangeText(range), kind: 'gt', v1: '', v2: '', fill: '#ffd6d6', color: '#9c0006', bold: false, lo: '#ffffff', hi: '#63be7b' });
  const addCf = () => {
    if (!cfDlg) return;
    const g = parseRange(cfDlg.range.trim());
    if (!g) { setCfDlg({ ...cfDlg, error: 'Type the cells as a range such as B2:B20.' }); return; }
    const needs1 = !['blank', 'notblank', 'scale'].includes(cfDlg.kind);
    if (needs1 && cfDlg.v1.trim() === '') { setCfDlg({ ...cfDlg, error: 'Type the value to compare with.' }); return; }
    if (cfDlg.kind === 'between' && cfDlg.v2.trim() === '') { setCfDlg({ ...cfDlg, error: 'Type both ends of the range.' }); return; }
    const rule: CfRule = { id: `cf${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, range: g, kind: cfDlg.kind, ...(needs1 ? { v1: cfDlg.v1.trim() } : {}), ...(cfDlg.kind === 'between' ? { v2: cfDlg.v2.trim() } : {}), ...(cfDlg.kind === 'scale' ? { lo: cfDlg.lo, hi: cfDlg.hi } : { fill: cfDlg.fill, color: cfDlg.color, ...(cfDlg.bold ? { bold: true } : {}) }) };
    edit((s0) => ({ ...s0, cf: [...(s0.cf ?? []), rule] })); setCfDlg({ ...cfDlg, v1: '', v2: '', error: undefined });
  };
  const describeCf = (r: CfRule) => `${rangeText(r.range)}: ${CF_KINDS.find(([k]) => k === r.kind)?.[1] ?? r.kind}${r.v1 ? ` ${r.v1}` : ''}${r.v2 ? ` and ${r.v2}` : ''}`;
  const openDvDlg = () => {
    const v = validationAt(sheet, active.r, active.c);
    setDvDlg(v ? { range: rangeText(v.range), kind: v.kind === 'list' ? (v.items ? 'list' : 'source') : v.kind, items: (v.items ?? []).join(', '), source: v.source ?? '', min: v.min === undefined ? '' : String(v.min), max: v.max === undefined ? '' : String(v.max), blank: v.blank, message: v.message ?? '' } : { range: rangeText(range), kind: 'list', items: '', source: '', min: '', max: '', blank: true, message: '' });
  };
  const saveDv = () => {
    if (!dvDlg) return;
    const g = parseRange(dvDlg.range.trim());
    if (!g) { setDvDlg({ ...dvDlg, error: 'Type the cells as a range such as B2:B20.' }); return; }
    const base = { range: g, blank: dvDlg.blank, ...(dvDlg.message.trim() ? { message: dvDlg.message.trim() } : {}) };
    let v: Validation;
    if (dvDlg.kind === 'list') { const items = dvDlg.items.split(',').map((x) => x.trim()).filter(Boolean); if (!items.length) { setDvDlg({ ...dvDlg, error: 'Type the choices, separated by commas.' }); return; } v = { ...base, kind: 'list', items }; }
    else if (dvDlg.kind === 'source') { if (!parseRange(dvDlg.source.trim())) { setDvDlg({ ...dvDlg, error: 'Type the cells holding the choices, such as E2:E9.' }); return; } v = { ...base, kind: 'list', source: dvDlg.source.trim() }; }
    else { const min = dvDlg.min.trim() === '' ? undefined : Number(dvDlg.min), max = dvDlg.max.trim() === '' ? undefined : Number(dvDlg.max); if ((min === undefined && max === undefined) || Number.isNaN(min) || Number.isNaN(max)) { setDvDlg({ ...dvDlg, error: 'Type a smallest and/or largest number.' }); return; } v = { ...base, kind: dvDlg.kind, ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }) }; }
    const clash = (x: Validation) => !(x.range.r2 < g.r1 || x.range.r1 > g.r2 || x.range.c2 < g.c1 || x.range.c1 > g.c2);
    edit((s0) => ({ ...s0, dv: [...(s0.dv ?? []).filter((x) => !clash(x)), v] })); setDvDlg(null); grid.current?.focus();
  };
  const removeDv = () => { edit((s0) => { const g = dvDlg ? parseRange(dvDlg.range.trim()) ?? range : range; const next = (s0.dv ?? []).filter((x) => x.range.r2 < g.r1 || x.range.r1 > g.r2 || x.range.c2 < g.c1 || x.range.c1 > g.c2); const o = { ...s0 }; if (next.length) o.dv = next; else delete o.dv; return o; }); setDvDlg(null); };
  const makeFilter = () => { const g = regionOrRange(); if (g.r2 <= g.r1) { saver.setMessage('A filter needs a heading row and at least one row below it.'); return; } edit((s0) => ({ ...s0, filter: { range: g, show: {} } })); };
  const dropFilter = () => edit((s0) => { const o = { ...s0 }; delete o.filter; return o; });
  const openFilterDlg = (col: number) => { const f = sheet.filter; if (!f) return; const all = columnValues(sheet, f, col).map((x) => x.text), allowed = f.show[col]; setFilterDlg({ col, off: new Set(allowed ? all.filter((t) => !allowed.includes(t)) : []) }); };
  const applyFilter = () => {
    if (!filterDlg || !sheet.filter) return;
    const all = columnValues(sheet, sheet.filter, filterDlg.col).map((x) => x.text);
    const show = { ...sheet.filter.show }; if (filterDlg.off.size) show[filterDlg.col] = all.filter((t) => !filterDlg.off.has(t)); else delete show[filterDlg.col];
    edit((s0) => ({ ...s0, filter: { ...s0.filter!, show } })); setFilterDlg(null);
  };
  const filterSort = (asc: boolean) => { if (!filterDlg || !sheet.filter) return; edit((s0) => sortRange(s0, s0.filter!.range, filterDlg.col, asc, true)); setFilterDlg(null); };

  // ---- charts
  const CHART_TYPES: [ChartType, string][] = [['column', 'Column'], ['bar', 'Bar'], ['line', 'Line'], ['area', 'Area'], ['scatter', 'Scatter (first column is x)'], ['pie', 'Pie']];
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
    clip.current = { text, cells, from: { r: range.r1, c: range.c1 } };
    if (cut) edit((s) => clearRange(s, range));
    return text;
  };
  const doPaste = (text: string) => {
    const at = { r: range.r1, c: range.c1 };
    const mode = pasteMode.current; pasteMode.current = null;
    if (clip.current && clip.current.text === text) {
      const from = clip.current.from, src = clip.current.cells;
      const shaped = src.map((row) => row.map((cell) => (cell.f !== undefined ? { ...cell, f: shiftFormula(cell.f, at.r - from.r, at.c - from.c) } : cell)));
      const grow = { anchor: at, focus: { r: at.r + src.length - 1, c: at.c + (src[0]?.length ?? 1) - 1 } };
      if (mode === 'format') edit((s0) => pasteFormats(s0, at, src)); else edit((s0) => setMany(s0, at, mode === 'values' ? valuesOf(src) : shaped));
      setSel(grow); return;
    }
    const grid2 = fromTsv(text);
    const cells: Cell[][] = grid2.map((r) => r.map((t) => ({ v: parseInput(t, !isCsv) })));
    if (mode !== 'format') edit((s0) => setMany(s0, at, cells));
    setSel({ anchor: at, focus: { r: at.r + cells.length - 1, c: at.c + Math.max(...cells.map((r) => r.length)) - 1 } });
  };
  /** Edit > Paste special: from the cells copied in this sheet (what the system clipboard holds is pasted as plain values by Ctrl+Shift+V) */
  const pasteSpecial = (mode: 'values' | 'format') => { if (!clip.current) { saver.setMessage('Copy some cells first.'); return; } pasteMode.current = mode; doPaste(clip.current.text); };
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
  const toggle = (flag: 'b' | 'i' | 'u' | 'st') => apply({ [flag]: !allHave(sheet, range, flag) });
  /** paint format: take the look of the cell you are on and give it to what you select next */
  const startPaint = () => {
    if (painting) { paintRef.current = null; setPainting(false); return; }
    paintRef.current = { fmt: activeCell?.s ? JSON.parse(JSON.stringify(activeCell.s)) as CellFmt : undefined, last: null }; setPainting(true);
    const done = () => { const p = paintRef.current; if (p?.last) { const g = norm(p.last.anchor, p.last.focus); edit((s0) => setFormat(s0, g, p.fmt)); } paintRef.current = null; setPainting(false); };
    window.addEventListener('pointerup', () => setTimeout(done, 0), { once: true });
  };
  const clearFormatting = () => edit((s0) => setFormat(s0, range, undefined));
  const duplicateSheet = (i: number) => commit((b) => { const src = b.sheets[i]; let name = `Copy of ${src.name}`.slice(0, 31), n = 2; while (b.sheets.some((x) => x.name === name)) name = `Copy ${n++} of ${src.name}`.slice(0, 31); const copy = JSON.parse(JSON.stringify(src)) as Sheet; return { ...b, sheets: [...b.sheets.slice(0, i + 1), { ...copy, name }, ...b.sheets.slice(i + 1)], active: i + 1 }; });
  const moveSheet = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= book.sheets.length) return; commit((b) => { const a = [...b.sheets]; [a[i], a[j]] = [a[j], a[i]]; return { ...b, sheets: a, active: j }; }); };
  const setZoomPct = (z: number) => setZoom(Math.min(300, Math.max(50, z)));
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
    if (e.altKey && e.shiftKey && e.code === 'Digit5') { toggle('st'); return true; }
    if (mod && e.altKey && k.toLowerCase() === 'v') { pasteSpecial('format'); return true; }
    if (mod && !e.altKey) {
      const l = k.toLowerCase();
      if (l === 's') { void doSave(e.shiftKey); return true; }
      if (l === 'k' && !isCsv) { openLinkDlg(); return true; }
      if (l === 'f' || l === 'h') { setFind((f0) => f0 ?? { q: '', rep: '', matchCase: false, wholeCell: false, idx: 0 }); return true; }
      if (l === 'z') { if (e.shiftKey) h.redo(); else h.undo(); setDirty(true); setDirtyState(true); return true; }
      if (l === 'y') { h.redo(); return true; }
      if (l === 'v' && e.shiftKey) { pasteMode.current = 'values'; return false; } // paste as values: the browser's paste event follows
      if (k === '\\') { clearFormatting(); return true; }
      if (e.shiftKey && e.code === 'Digit4') { apply({ nf: '"$"#,##0.00' }); return true; }
      if (e.shiftKey && e.code === 'Digit5') { apply({ nf: '0%' }); return true; }
      if (e.shiftKey && e.code === 'Digit1') { apply({ nf: '#,##0.00' }); return true; }
      if (k === ';' && !e.shiftKey && !isCsv) { edit((s0) => typeInto(s0, active.r, active.c, new Date().toISOString().slice(0, 10))); return true; }
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
    if (k === 'F11' && e.shiftKey && !isCsv) { addSheet(); return true; }
    if (k === 'Delete' || k === 'Backspace') { edit((s) => clearRange(s, range)); return true; }
    if (k === 'Escape') { setBar(null); if (painting) { paintRef.current = null; setPainting(false); } return true; }
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
      { label: 'Undo', keys: 'Ctrl+Z', disabled: !h.canUndo, run: h.undo }, { label: 'Redo', keys: 'Ctrl+Y', disabled: !h.canRedo, run: h.redo }, sep,
      { label: 'Cut', keys: 'Ctrl+X', run: () => menuClip('cut') }, { label: 'Copy', keys: 'Ctrl+C', run: () => menuClip('copy') }, { label: 'Paste', keys: 'Ctrl+V', run: () => menuClip('paste') },
      { label: 'Paste special', sub: [{ label: 'Values only', keys: 'Ctrl+Shift+V', run: () => pasteSpecial('values') }, { label: 'Formatting only', keys: 'Ctrl+Alt+V', run: () => pasteSpecial('format') }] }, sep,
      { label: 'Delete', sub: [{ label: 'Values', keys: 'Delete', run: () => edit((s) => clearRange(s, range)) }, { label: 'Row', run: () => edit((s) => deleteRows(s, rowsSel.from, rowsSel.to)) }, { label: 'Column', run: () => edit((s) => deleteCols(s, colsSel.from, colsSel.to)) }] }, sep,
      { label: 'Find and replace', keys: 'Ctrl+H', run: () => setFind((f0) => f0 ?? { q: '', rep: '', matchCase: false, wholeCell: false, idx: 0 }) }, sep,
      { label: 'Fill down', keys: 'Ctrl+D', run: () => edit((s) => fill(s, range, 'down')) }, { label: 'Fill right', keys: 'Ctrl+R', run: () => edit((s) => fill(s, range, 'right')) }, { label: 'Select all', keys: 'Ctrl+A', run: () => setSel({ anchor: { r: 0, c: 0 }, focus: { r: Math.max(0, ext.rows - 1), c: Math.max(0, ext.cols - 1) } }) },
    ] },
    { label: 'View', items: [
      ...(isCsv ? [] : [{ label: 'Freeze', sub: [
        { label: 'No rows', check: !sheet.freeze?.rows, run: () => freeze(0, sheet.freeze?.cols ?? 0) }, { label: '1 row', check: sheet.freeze?.rows === 1, run: () => freeze(1, sheet.freeze?.cols ?? 0) }, { label: '2 rows', check: sheet.freeze?.rows === 2, run: () => freeze(2, sheet.freeze?.cols ?? 0) }, { label: `Up to row ${active.r + 1}`, run: () => freeze(active.r + 1, sheet.freeze?.cols ?? 0) }, sep,
        { label: 'No columns', check: !sheet.freeze?.cols, run: () => freeze(sheet.freeze?.rows ?? 0, 0) }, { label: '1 column', check: sheet.freeze?.cols === 1, run: () => freeze(sheet.freeze?.rows ?? 0, 1) }, { label: '2 columns', check: sheet.freeze?.cols === 2, run: () => freeze(sheet.freeze?.rows ?? 0, 2) }, { label: `Up to column ${colLetter(active.c)}`, run: () => freeze(sheet.freeze?.rows ?? 0, active.c + 1) },
      ] } as MenuItem, sep]),
      { label: 'Zoom', sub: [50, 75, 90, 100, 125, 150, 200].map((z): MenuItem => ({ label: `${z}%`, check: zoom === z, run: () => setZoomPct(z) })) }, sep,
      { label: 'Full screen', keys: 'F11', run: () => desktop()?.windowControl?.('fullscreen') },
    ] },
    { label: 'Insert', items: [
      { label: 'Row above', run: () => edit((s) => insertRows(s, range.r1, range.r2 - range.r1 + 1)) }, { label: 'Row below', run: () => edit((s) => insertRows(s, range.r2 + 1, range.r2 - range.r1 + 1)) },
      { label: 'Column left', run: () => edit((s) => insertCols(s, range.c1, range.c2 - range.c1 + 1)) }, { label: 'Column right', run: () => edit((s) => insertCols(s, range.c2 + 1, range.c2 - range.c1 + 1)) },
      ...(isCsv ? [] : [sep, { label: 'Sheet', keys: 'Shift+F11', run: addSheet } as MenuItem, sep,
        { label: 'Chart', run: () => openChartDlg() } as MenuItem, ...(chartSel ? [{ label: 'Edit the selected chart…', run: () => openChartDlg(chartSel) } as MenuItem, { label: 'Delete the selected chart', run: () => deleteChart(chartSel) } as MenuItem] : []),
        { label: 'Link', keys: 'Ctrl+K', run: openLinkDlg } as MenuItem, { label: 'Remove link', disabled: !activeCell?.link, run: () => edit((s0) => setLink(s0, range, undefined)) } as MenuItem, { label: 'Dropdown', run: openDvDlg } as MenuItem]),
    ] },
    { label: 'Format', items: [
      { label: 'Number', sub: [...nfItems, sep, { label: 'Increase decimal places', run: () => decimals(1) }, { label: 'Decrease decimal places', run: () => decimals(-1) }] },
      { label: 'Text', sub: [{ label: 'Bold', keys: 'Ctrl+B', check: allHave(sheet, range, 'b'), run: () => toggle('b') }, { label: 'Italic', keys: 'Ctrl+I', check: allHave(sheet, range, 'i'), run: () => toggle('i') }, { label: 'Underline', keys: 'Ctrl+U', check: allHave(sheet, range, 'u'), run: () => toggle('u') }, { label: 'Strikethrough', keys: 'Alt+Shift+5', check: allHave(sheet, range, 'st'), run: () => toggle('st') }] },
      { label: 'Alignment', sub: [{ label: 'Left', check: activeCell?.s?.align === 'left', run: () => apply({ align: 'left' }) }, { label: 'Center', check: activeCell?.s?.align === 'center', run: () => apply({ align: 'center' }) }, { label: 'Right', check: activeCell?.s?.align === 'right', run: () => apply({ align: 'right' }) }, sep,
        ...(['top', 'middle', 'bottom'] as const).map((v): MenuItem => ({ label: v[0].toUpperCase() + v.slice(1), check: activeCell?.s?.va === v, run: () => apply({ va: v }) }))] },
      { label: 'Wrapping', sub: [{ label: 'Overflow', check: !activeCell?.s?.wrap, run: () => apply({ wrap: false }) }, { label: 'Wrap', check: !!activeCell?.s?.wrap, run: () => apply({ wrap: true }) }] },
      { label: 'Merge cells', sub: [
        { label: 'Merge all', run: () => edit((s) => mergeRange(s, range)) },
        { label: 'Merge horizontally', run: () => edit((s) => { let o = s; for (let r = range.r1; r <= range.r2; r++) o = mergeRange(o, { ...range, r1: r, r2: r }); return o; }) },
        { label: 'Merge vertically', run: () => edit((s) => { let o = s; for (let c = range.c1; c <= range.c2; c++) o = mergeRange(o, { ...range, c1: c, c2: c }); return o; }) },
        { label: 'Unmerge', run: () => edit((s) => unmergeRange(s, range)) }] },
      { label: 'Borders', sub: BORDER_MODES.map(([m, l]): MenuItem => ({ label: l, run: () => borders(m) })) }, sep,
      ...(isCsv ? [] : [{ label: 'Conditional formatting', run: openCfDlg } as MenuItem, sep]),
      { label: 'Fit column width to the text', run: () => { for (let c = range.c1; c <= range.c2; c++) autoFit(c); } },
      { label: 'Clear formatting', keys: 'Ctrl+\\', run: clearFormatting },
    ] },
    { label: 'Data', items: [
      { label: `Sort sheet by column ${colLetter(active.c)}, A → Z`, run: () => sortBy(true) }, { label: `Sort sheet by column ${colLetter(active.c)}, Z → A`, run: () => sortBy(false) }, { label: 'Data has header row', check: header, run: () => setHeader(!header) },
      ...(isCsv ? [] : [sep, { label: sheet.filter ? 'Remove filter' : 'Create a filter', run: () => (sheet.filter ? dropFilter() : makeFilter()) } as MenuItem, { label: 'Data validation', run: openDvDlg } as MenuItem]),
    ] },
  ];

  const ctxItems = (kind: ContextAt['kind']): MenuItem[] => {
    const rowsN = range.r2 - range.r1 + 1, colsN = range.c2 - range.c1 + 1;
    const rowItems: MenuItem[] = [{ label: `Insert ${rowsN} row${rowsN > 1 ? 's' : ''} above`, run: () => edit((s0) => insertRows(s0, range.r1, rowsN)) }, { label: `Insert ${rowsN} row${rowsN > 1 ? 's' : ''} below`, run: () => edit((s0) => insertRows(s0, range.r2 + 1, rowsN)) }, { label: `Delete row${rowsN > 1 ? 's' : ''}`, run: () => edit((s0) => deleteRows(s0, rowsSel.from, rowsSel.to)) }];
    const colItems: MenuItem[] = [{ label: `Insert ${colsN} column${colsN > 1 ? 's' : ''} left`, run: () => edit((s0) => insertCols(s0, range.c1, colsN)) }, { label: `Insert ${colsN} column${colsN > 1 ? 's' : ''} right`, run: () => edit((s0) => insertCols(s0, range.c2 + 1, colsN)) }, { label: `Delete column${colsN > 1 ? 's' : ''}`, run: () => edit((s0) => deleteCols(s0, colsSel.from, colsSel.to)) }];
    const clipItems: MenuItem[] = [{ label: 'Cut', keys: 'Ctrl+X', run: () => menuClip('cut') }, { label: 'Copy', keys: 'Ctrl+C', run: () => menuClip('copy') }, { label: 'Paste', keys: 'Ctrl+V', run: () => menuClip('paste') }, { label: 'Paste special', sub: [{ label: 'Values only', keys: 'Ctrl+Shift+V', run: () => pasteSpecial('values') }, { label: 'Formatting only', keys: 'Ctrl+Alt+V', run: () => pasteSpecial('format') }] }];
    const frozen: MenuItem[] = isCsv ? [] : [sep, { label: `Freeze up to row ${active.r + 1}`, run: () => freeze(active.r + 1, sheet.freeze?.cols ?? 0) }, { label: `Freeze up to column ${colLetter(active.c)}`, run: () => freeze(sheet.freeze?.rows ?? 0, active.c + 1) }, { label: 'Unfreeze', disabled: !sheet.freeze, run: () => freeze(0, 0) }];
    const clear: MenuItem = { label: 'Clear values', keys: 'Delete', run: () => edit((s0) => clearRange(s0, range)) };
    if (kind === 'col') return [...clipItems, sep, ...colItems, sep, clear, { label: 'Sort A → Z', run: () => sortBy(true) }, { label: 'Sort Z → A', run: () => sortBy(false) }, { label: 'Fit width to the text', run: () => { for (let c = range.c1; c <= range.c2; c++) autoFit(c); } }, ...frozen];
    if (kind === 'row') return [...clipItems, sep, ...rowItems, sep, clear, ...frozen];
    return [...clipItems, sep, ...rowItems, ...colItems, sep, ...(isCsv ? [] : [{ label: 'Insert link', keys: 'Ctrl+K', run: openLinkDlg } as MenuItem, { label: 'Dropdown', run: openDvDlg } as MenuItem, sep]), clear, { label: 'Clear values and formats', run: () => edit((s0) => clearRange(s0, range, true)) }, { label: 'Merge cells', disabled: range.r1 === range.r2 && range.c1 === range.c2, run: () => edit((s0) => mergeRange(s0, range)) }, sep, { label: 'Sort A → Z by this column', run: () => sortBy(true) }, { label: 'Sort Z → A by this column', run: () => sortBy(false) }, ...frozen];
  };
  const st = useMemo(() => (range.r1 === range.r2 && range.c1 === range.c2 ? null : stats(sheet, range)), [sheet, range.r1, range.r2, range.c1, range.c2]); // eslint-disable-line react-hooks/exhaustive-deps
  const num = (n: number) => String(Number(n.toPrecision(10)));
  const barText = bar ?? editText(activeCell);
  const size = activeCell?.s?.size ?? 11;
  const merged = !!mergeAt(sheet, active.r, active.c);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <MenuBar menus={menus} label="Spreadsheet menu" lead={<DocTitle name={saver.name} path={saver.path} dirty={dirty} />} trail={<DocActions path={saver.path} dirty={dirty} busy={saver.busy} onSave={() => void doSave()} onSaveAs={() => void doSave(true)} />} />
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
      <OverflowBar label="Formatting" groups={[
        <>
          <Btn label="Undo (Ctrl+Z)" onClick={h.undo} disabled={!h.canUndo}><Undo2 size={16} /></Btn>
          <Btn label="Redo (Ctrl+Y)" onClick={h.redo} disabled={!h.canRedo}><Redo2 size={16} /></Btn>
          <Btn label="Paint format" active={painting} onClick={startPaint}><Paintbrush size={16} /></Btn>
          <Select label="Zoom" className="!w-[4.75rem] !px-1.5 !py-1" value={[50, 75, 90, 100, 125, 150, 200].includes(zoom) ? zoom : 100} options={[50, 75, 90, 100, 125, 150, 200].map((z) => ({ value: z, label: `${z}%` }))} onChange={(v) => setZoomPct(v)} />
        </>,
        <>
          <Btn label="Format as currency (Ctrl+Shift+4)" onClick={() => apply({ nf: '"$"#,##0.00' })}><DollarSign size={16} /></Btn>
          <Btn label="Format as percent (Ctrl+Shift+5)" onClick={() => apply({ nf: '0%' })}><Percent size={16} /></Btn>
          <Btn label="Decrease decimal places" onClick={() => decimals(-1)}><span className="text-xs tabular-nums">.0←</span></Btn>
          <Btn label="Increase decimal places" onClick={() => decimals(1)}><span className="text-xs tabular-nums">.00→</span></Btn>
          <Select label="Number format" className="!w-32 !py-1" value={NUMBER_FORMATS.find((n) => n.code === (activeCell?.s?.nf ?? null))?.label ?? 'Automatic'} options={NUMBER_FORMATS.map((n) => ({ value: n.label, label: n.label }))} onChange={(v) => setNf(NUMBER_FORMATS.find((n) => n.label === v)?.code ?? null)} />
        </>,
        <>
          <FontBox value={activeCell?.s?.font ?? 'Calibri'} onPick={(f) => apply({ font: f })} />
          <SizeBox value={size} sizes={SIZES} onCommit={(t) => { const n = Number(t.replace(',', '.')); if (n >= 1 && n <= 400) apply({ size: n }); }} />
        </>,
        <>
          <Btn label="Bold (Ctrl+B)" active={allHave(sheet, range, 'b')} onClick={() => toggle('b')}><Bold size={16} /></Btn>
          <Btn label="Italic (Ctrl+I)" active={allHave(sheet, range, 'i')} onClick={() => toggle('i')}><Italic size={16} /></Btn>
          <Btn label="Underline (Ctrl+U)" active={allHave(sheet, range, 'u')} onClick={() => toggle('u')}><Underline size={16} /></Btn>
          <Btn label="Strikethrough (Alt+Shift+5)" active={allHave(sheet, range, 'st')} onClick={() => toggle('st')}><Strikethrough size={16} /></Btn>
          <SplitColour label="Text colour" icon={<Baseline size={15} />} last={textColour} onApply={(c) => apply({ color: c })} onPick={(c) => { setTextColour(c); apply({ color: c }); }} />
        </>,
        <>
          <SplitColour label="Fill colour" icon={<PaintBucket size={15} />} last={fillColour} onApply={(c) => apply({ fill: c })} onPick={(c) => { setFillColour(c); apply({ fill: c }); }} />
          <Select label="Borders" title="Borders (uses the style and colour beside it)" className="!w-28 !px-1.5 !py-1" display="▦ Borders" options={BORDER_MODES.map(([m, l]) => ({ value: m as string, label: l }))} onChange={(v) => borders(v as BorderMode)} />
          <Select label="Border style" className="!w-24 !px-1.5 !py-1" value={borderStyle} options={BORDER_STYLES.map((b) => ({ value: b as string, label: b }))} onChange={(v) => setBorderStyle(v as Edge['st'])} />
          <SplitColour label="Border colour" icon={<Grid3x3 size={15} />} last={borderColour} onApply={(c) => setBorderColour(c)} onPick={(c) => setBorderColour(c)} />
          <Btn label={merged ? 'Unmerge cells' : 'Merge cells'} active={merged} onClick={() => edit((s) => (merged ? unmergeRange(s, range) : mergeRange(s, range)))}><Merge size={16} /></Btn>
        </>,
        <>
          <Btn label="Align left" active={activeCell?.s?.align === 'left'} onClick={() => apply({ align: 'left' })}><AlignLeft size={16} /></Btn>
          <Btn label="Align center" active={activeCell?.s?.align === 'center'} onClick={() => apply({ align: 'center' })}><AlignCenter size={16} /></Btn>
          <Btn label="Align right" active={activeCell?.s?.align === 'right'} onClick={() => apply({ align: 'right' })}><AlignRight size={16} /></Btn>
          <Btn label="Align top" active={activeCell?.s?.va === 'top'} onClick={() => apply({ va: 'top' })}><AlignVerticalJustifyStart size={16} /></Btn>
          <Btn label="Align middle" active={activeCell?.s?.va === 'middle'} onClick={() => apply({ va: 'middle' })}><AlignVerticalJustifyCenter size={16} /></Btn>
          <Btn label="Align bottom" active={activeCell?.s?.va === 'bottom'} onClick={() => apply({ va: 'bottom' })}><AlignVerticalJustifyEnd size={16} /></Btn>
          <Btn label="Wrap text" active={!!activeCell?.s?.wrap} onClick={() => apply({ wrap: !activeCell?.s?.wrap })}><WrapText size={16} /></Btn>
        </>,
        <>
          {!isCsv && <Btn label="Insert link (Ctrl+K)" active={!!activeCell?.link} onClick={openLinkDlg}><Link2 size={16} /></Btn>}
          {!isCsv && <Btn label="Insert chart" onClick={() => openChartDlg()}><BarChart3 size={16} /></Btn>}
          {!isCsv && <Btn label={sheet.filter ? 'Remove filter' : 'Create a filter'} active={!!sheet.filter} onClick={() => (sheet.filter ? dropFilter() : makeFilter())}><Filter size={16} /></Btn>}
          <Btn label="Sort A to Z by this column" onClick={() => sortBy(true)}><ArrowDownAZ size={16} /></Btn>
          <Btn label="Sort Z to A by this column" onClick={() => sortBy(false)}><ArrowUpAZ size={16} /></Btn>
        </>,
      ]} />
      <div className="flex items-center gap-2 border-b border-line px-2 py-1 text-sm">
        <span className="w-20 shrink-0 rounded-theme bg-raised px-2 py-0.5 text-center text-xs tabular-nums" aria-label="Selection">{rangeText(range)}</span>
        <span className="text-muted">ƒ</span>
        <input aria-label="Formula bar" className="input !py-0.5 text-sm" value={barText} onFocus={() => setBar(editText(activeCell))} onChange={(e) => setBar(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); finish({ pos: active, text: barText, typed: false }, 'down'); setBar(null); } else if (e.key === 'Escape') { setBar(null); grid.current?.focus(); } }} onBlur={() => setBar(null)} />
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <Grid ref={grid} sheet={sheet} rows={rows} cols={cols} zoom={zoom} sel={sel} onSel={(s) => { setSel(s); setBar(null); if (paintRef.current) paintRef.current.last = s; }} editing={editing} setEditing={setEditing} onCommit={(p, t, m) => finish({ pos: p, text: t, typed: false }, m)}
          onKey={onKey} onResize={(kind, i, size) => edit((s) => (kind === 'col' ? { ...s, colW: { ...s.colW, [i]: size } } : { ...s, rowH: { ...s.rowH, [i]: size } }))} onCopy={doCopy} onPaste={doPaste}
          cf={cfEval} hidden={hidden} filterHeads={sheet.filter ? { r: sheet.filter.range.r1, c1: sheet.filter.range.c1, c2: sheet.filter.range.c2, active: new Set(Object.keys(sheet.filter.show).map(Number)) } : null} listCell={(() => { const v = validationAt(sheet, active.r, active.c); return v?.kind === 'list' ? key(active.r, active.c) : null; })()} onLink={openLink} onFilterMenu={(c) => openFilterDlg(c)} onListMenu={(r, c, at) => setListMenu({ at, r, c })}
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
      {listMenu && (() => { const v = validationAt(sheet, listMenu.r, listMenu.c); return v ? <ContextMenu at={listMenu.at} items={listItems(sheet, v).map((t): MenuItem => ({ label: t, check: formatCell(sheet.cells[key(listMenu.r, listMenu.c)]) === t, run: () => { const { r, c } = listMenu; edit((s0) => typeInto(s0, r, c, t)); } }))} onClose={() => { setListMenu(null); grid.current?.focus(); }} /> : null; })()}
      {linkDlg && (
        <Dialog title="Link" onClose={() => { setLinkDlg(null); grid.current?.focus(); }} footer={<><button className="btn" onClick={() => { setLinkDlg(null); grid.current?.focus(); }}>Cancel</button><button className="btn btn-accent" onClick={saveLink}>{linkDlg.url.trim() ? 'Apply' : 'Remove link'}</button></>}>
          <label className="grid gap-1 text-sm">Web or e-mail address<input autoFocus aria-label="Link address" className="input" placeholder="https://example.com" value={linkDlg.url} onChange={(e) => setLinkDlg({ url: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveLink(); } }} /></label>
          <p className="mt-2 text-xs text-muted">Applies to the selected cells. Ctrl+click a linked cell to open it.</p>
        </Dialog>
      )}
      {cfDlg && (
        <Dialog title="Conditional formatting" wide onClose={() => { setCfDlg(null); grid.current?.focus(); }} footer={<button className="btn btn-accent" onClick={() => { setCfDlg(null); grid.current?.focus(); }}>Done</button>}>
          <div className="grid gap-3 text-sm">
            {(sheet.cf ?? []).length > 0 && (
              <ul aria-label="Rules" className="grid gap-1">
                {(sheet.cf ?? []).map((r) => (
                  <li key={r.id} className="flex items-center gap-2 rounded-theme border border-line px-2 py-1"><span className="inline-block h-4 w-4 rounded border border-line" style={{ background: r.kind === 'scale' ? `linear-gradient(90deg, ${r.lo}, ${r.hi})` : r.fill }} /><span className="flex-1">{describeCf(r)}</span>
                    <button className="btn btn-ghost text-xs" aria-label={`Delete rule ${describeCf(r)}`} onClick={() => edit((s0) => { const next = (s0.cf ?? []).filter((x) => x.id !== r.id); const o = { ...s0 }; if (next.length) o.cf = next; else delete o.cf; return o; })}>Delete</button></li>
                ))}
              </ul>
            )}
            <div className="grid gap-2 rounded-theme border border-line p-2">
              <b>Add a rule</b>
              <label className="grid gap-1">Cells <input aria-label="Rule cells" className="input" value={cfDlg.range} onChange={(e) => setCfDlg({ ...cfDlg, range: e.target.value, error: undefined })} /></label>
              <label className="grid gap-1">Format cells if
                <Select label="Rule kind" className="w-full" value={cfDlg.kind} options={CF_KINDS.map(([k, l]) => ({ value: k as string, label: l }))} onChange={(v) => setCfDlg({ ...cfDlg, kind: v as CfRule['kind'] })} /></label>
              {!['blank', 'notblank', 'scale'].includes(cfDlg.kind) && <div className="flex gap-2"><input aria-label="Rule value" className="input" placeholder={cfDlg.kind === 'text' ? 'Text' : 'Value'} value={cfDlg.v1} onChange={(e) => setCfDlg({ ...cfDlg, v1: e.target.value, error: undefined })} />{cfDlg.kind === 'between' && <input aria-label="Rule second value" className="input" placeholder="and" value={cfDlg.v2} onChange={(e) => setCfDlg({ ...cfDlg, v2: e.target.value, error: undefined })} />}</div>}
              {cfDlg.kind === 'scale'
                ? <div className="flex items-center gap-3">Lowest <ColourField label="Lowest colour" value={cfDlg.lo} onChange={(c) => setCfDlg({ ...cfDlg, lo: c })} /> Highest <ColourField label="Highest colour" value={cfDlg.hi} onChange={(c) => setCfDlg({ ...cfDlg, hi: c })} /></div>
                : <div className="flex items-center gap-3">Fill <ColourField label="Rule fill" value={cfDlg.fill} onChange={(c) => setCfDlg({ ...cfDlg, fill: c })} /> Text <ColourField label="Rule text colour" value={cfDlg.color} onChange={(c) => setCfDlg({ ...cfDlg, color: c })} /><label className="flex items-center gap-1"><input type="checkbox" checked={cfDlg.bold} onChange={(e) => setCfDlg({ ...cfDlg, bold: e.target.checked })} />Bold</label></div>}
              {cfDlg.error && <p role="alert" className="text-bad">{cfDlg.error}</p>}
              <div><button className="btn btn-accent" onClick={addCf}>Add rule</button></div>
            </div>
          </div>
        </Dialog>
      )}
      {dvDlg && (
        <Dialog title="Data validation" onClose={() => { setDvDlg(null); grid.current?.focus(); }} footer={<><button className="btn mr-auto" onClick={removeDv}>Remove validation</button><button className="btn" onClick={() => { setDvDlg(null); grid.current?.focus(); }}>Cancel</button><button className="btn btn-accent" onClick={saveDv}>Save</button></>}>
          <div className="grid gap-3 text-sm">
            <label className="grid gap-1">Cells <input aria-label="Validation cells" className="input" value={dvDlg.range} onChange={(e) => setDvDlg({ ...dvDlg, range: e.target.value, error: undefined })} /></label>
            <label className="grid gap-1">Allow
              <Select label="Validation kind" className="w-full" value={dvDlg.kind} options={[{ value: 'list', label: 'A list of choices' }, { value: 'source', label: 'A list from cells' }, { value: 'whole', label: 'A whole number' }, { value: 'decimal', label: 'A number' }]} onChange={(v) => setDvDlg({ ...dvDlg, kind: v as NonNullable<typeof dvDlg>['kind'] })} /></label>
            {dvDlg.kind === 'list' && <label className="grid gap-1">Choices (separated by commas)<input aria-label="Validation choices" className="input" value={dvDlg.items} onChange={(e) => setDvDlg({ ...dvDlg, items: e.target.value, error: undefined })} /></label>}
            {dvDlg.kind === 'source' && <label className="grid gap-1">Cells holding the choices<input aria-label="Validation source" className="input" placeholder="E2:E9" value={dvDlg.source} onChange={(e) => setDvDlg({ ...dvDlg, source: e.target.value, error: undefined })} /></label>}
            {(dvDlg.kind === 'whole' || dvDlg.kind === 'decimal') && <div className="flex gap-2"><label className="grid flex-1 gap-1">Smallest<input aria-label="Validation smallest" className="input" value={dvDlg.min} onChange={(e) => setDvDlg({ ...dvDlg, min: e.target.value, error: undefined })} /></label><label className="grid flex-1 gap-1">Largest<input aria-label="Validation largest" className="input" value={dvDlg.max} onChange={(e) => setDvDlg({ ...dvDlg, max: e.target.value, error: undefined })} /></label></div>}
            <label className="flex items-center gap-1"><input type="checkbox" checked={dvDlg.blank} onChange={(e) => setDvDlg({ ...dvDlg, blank: e.target.checked })} />Allow empty cells</label>
            <label className="grid gap-1">Message when the entry is refused (optional)<input aria-label="Validation message" className="input" value={dvDlg.message} onChange={(e) => setDvDlg({ ...dvDlg, message: e.target.value })} /></label>
            {dvDlg.error && <p role="alert" className="text-bad">{dvDlg.error}</p>}
          </div>
        </Dialog>
      )}
      {filterDlg && sheet.filter && (() => {
        const vals = columnValues(sheet, sheet.filter, filterDlg.col);
        const toggle = (t: string) => { const off = new Set(filterDlg.off); if (off.has(t)) off.delete(t); else off.add(t); setFilterDlg({ ...filterDlg, off }); };
        return (
          <Dialog title={`Filter column ${colLetter(filterDlg.col)}`} onClose={() => setFilterDlg(null)} footer={<><button className="btn" onClick={() => setFilterDlg(null)}>Cancel</button><button className="btn btn-accent" onClick={applyFilter}>Apply</button></>}>
            <div className="mb-2 flex flex-wrap gap-2 text-sm"><button className="btn text-xs" onClick={() => filterSort(true)}>Sort A → Z</button><button className="btn text-xs" onClick={() => filterSort(false)}>Sort Z → A</button><button className="btn text-xs" onClick={() => setFilterDlg({ ...filterDlg, off: new Set() })}>Select all</button><button className="btn text-xs" onClick={() => setFilterDlg({ ...filterDlg, off: new Set(vals.map((x) => x.text)) })}>Clear</button></div>
            <ul aria-label="Values" className="max-h-64 overflow-auto text-sm">
              {vals.map((v) => <li key={v.text}><label className="flex items-center gap-2 py-0.5"><input type="checkbox" checked={!filterDlg.off.has(v.text)} onChange={() => toggle(v.text)} /><span className="flex-1">{v.text === '' ? '(empty)' : v.text}</span><span className="text-xs text-muted tabular-nums">{v.n}</span></label></li>)}
            </ul>
          </Dialog>
        );
      })()}
      {chartDlg && (
        <Dialog title={chartDlg.id ? 'Edit chart' : 'Insert chart'} onClose={() => closeChartDlg()} footer={<>
          {chartDlg.id && <button className="btn mr-auto" onClick={() => { deleteChart(chartDlg.id!); closeChartDlg(); }}>Delete chart</button>}
          <button className="btn" onClick={() => closeChartDlg()}>Cancel</button><button className="btn btn-accent" onClick={saveChart}>{chartDlg.id ? 'Update' : 'Insert'}</button></>}>
          <div className="grid gap-3 text-sm">
            <label className="grid gap-1">Chart type
              <Select label="Chart type" className="w-full" value={chartDlg.type} options={CHART_TYPES.map(([t, l]) => ({ value: t as string, label: l }))} onChange={(v) => setChartDlg({ ...chartDlg, type: v as ChartType })} /></label>
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
      {tabMenu && <ContextMenu at={tabMenu.at} items={[
        { label: 'Delete', disabled: book.sheets.length < 2, run: () => removeSheet(tabMenu.i) }, { label: 'Duplicate', run: () => duplicateSheet(tabMenu.i) }, { label: 'Rename', run: () => setRenaming(tabMenu.i) }, sep,
        { label: 'Move right', disabled: tabMenu.i >= book.sheets.length - 1, run: () => moveSheet(tabMenu.i, 1) }, { label: 'Move left', disabled: tabMenu.i === 0, run: () => moveSheet(tabMenu.i, -1) },
      ]} onClose={() => { setTabMenu(null); grid.current?.focus(); }} />}
      {ctx && <ContextMenu at={ctx.at} items={ctxItems(ctx.kind)} onClose={() => { setCtx(null); grid.current?.focus(); }} />}
      <div className="bt-footer flex items-stretch overflow-x-auto border-t border-line" role="tablist" aria-label="Sheets">
        {book.sheets.map((s, i) => renaming === i
          ? <input key={i} autoFocus className="input !w-32 !py-0.5 text-sm" defaultValue={s.name} aria-label="Sheet name" onBlur={(e) => renameSheet(i, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setRenaming(null); }} />
          : <button key={i} role="tab" aria-selected={i === book.active} className="sheet-tab" onClick={() => showSheet(i)} onDoubleClick={() => !isCsv && setRenaming(i)} onContextMenu={(e) => { e.preventDefault(); if (!isCsv) { showSheet(i); setTabMenu({ at: { x: e.clientX, y: e.clientY }, i }); } }} title={isCsv ? s.name : 'Double-click to rename, right-click for more'}>{s.name}</button>)}
        {!isCsv && <button type="button" className="btn btn-ghost !px-2 !py-0.5" aria-label="Add sheet" title="Add sheet" onClick={addSheet}><Plus size={14} /></button>}
        <span className="flex-1" />
        <span className="self-center px-3 text-xs text-muted">Formulas are kept, not calculated yet</span>
      </div>
      <StatusBar editor={null} zoom={zoom} setZoom={(z) => setZoom(Math.min(300, Math.max(50, z)))} message={saver.message}
        extra={st ? <span className="tabular-nums">Sum {num(st.sum)} · Average {num(st.avg)} · Count {st.count}</span> : undefined} />
    </div>
  );
}
