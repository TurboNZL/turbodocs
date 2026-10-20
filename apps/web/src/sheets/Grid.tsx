import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cellText, colName, DEFAULT_COL_W, DEFAULT_ROW_H, isNumeric, key, type Cell, type Edge, type Range, type Sheet } from './model.ts';
import { formatCell } from './format.ts';
import { mergeAt } from './ops.ts';
import { ChartView } from './ChartView.tsx';
import { chartData } from './charts.ts';
import type { CfLook } from './rules.ts';

export interface Pos { r: number; c: number }
export interface Sel { anchor: Pos; focus: Pos }
export interface GridHandle { focus(): void; scrollTo(p: Pos): void }
export interface ContextAt { x: number; y: number; kind: 'cell' | 'col' | 'row'; r: number; c: number }
let measureCtx: CanvasRenderingContext2D | null | undefined;
/** how wide a cell's text is drawn (to let it run on into empty cells to its right, as Google Sheets does) */
const textWidth = (text: string, s: Cell['s']): number => {
  if (measureCtx === undefined) { try { measureCtx = document.createElement('canvas').getContext('2d'); } catch { measureCtx = null; } }
  if (!measureCtx) return text.length * 7.5;
  measureCtx.font = `${s?.i ? 'italic ' : ''}${s?.b ? 'bold ' : ''}${s?.size ? (s.size * 96) / 72 : 13}px ${s?.font ? `"${s.font}", ` : ''}sans-serif`;
  return measureCtx.measureText(text).width;
};
const EDGE_PX = { thin: 1, medium: 2, thick: 3, dashed: 1, dotted: 1, double: 3 } as const;
const edgeCss = (e: Edge | undefined) => (e ? `${EDGE_PX[e.st]}px ${e.st === 'dashed' || e.st === 'dotted' || e.st === 'double' ? e.st : 'solid'} ${e.c}` : undefined);

const HEAD_W = 46, HEAD_H = 24;
/** the cell's text as it is edited: a formula as "=…", anything else as it would be typed */
export const editText = cellText;

interface Props {
  sheet: Sheet; rows: number; cols: number; zoom: number; sel: Sel; onSel(s: Sel): void;
  editing: { pos: Pos; text: string; typed: boolean } | null; setEditing(e: Props['editing']): void; onCommit(pos: Pos, text: string, move: 'down' | 'right' | 'up' | 'left' | null): void;
  onKey(e: React.KeyboardEvent): boolean; onResize(kind: 'col' | 'row', index: number, size: number): void; onFillHandle?(): void;
  onCopy(cut: boolean): string | null; onPaste(text: string): void; readOnly?: boolean;
  /** the fill handle was dragged from `src` over `to` */ onFill?(src: Range, to: Range): void; onContext?(at: ContextAt): void;
  /** cells found by Find (and the one the search is on), drawn tinted */ hits?: Set<string>; hitNow?: string | null;
  /** charts float over the cells: click selects, drag moves, the corner resizes, double-click edits */
  /** conditional formatting, rows a filter hides, the filter's heading cells, the cell holding a pick-list */
  cf?: ((r: number, c: number) => CfLook | undefined) | null; hidden?: Set<number>; filterHeads?: { r: number; c1: number; c2: number; active: Set<number> } | null; listCell?: string | null;
  onLink?(url: string): void; onFilterMenu?(c: number, at: { x: number; y: number }): void; onListMenu?(r: number, c: number, at: { x: number; y: number }): void;
  chartSel?: string | null; onChartSel?(id: string | null): void; onChartMove?(id: string, f: { x: number; y: number; w: number; h: number }, first: boolean): void; onChartEdit?(id: string): void;
}

/**
 * The grid: only the rows and columns in view are drawn, so a sheet of tens of thousands of rows scrolls smoothly. Click and drag select, the headers select
 * a whole column or row and their edges resize it. Keyboard and clipboard are handled by the container; typing starts editing the active cell.
 */
export const Grid = forwardRef<GridHandle, Props>(function Grid({ sheet, rows, cols, zoom, sel, onSel, editing, setEditing, onCommit, onKey, onResize, onCopy, onPaste, onFill, onContext, hits, hitNow, cf, hidden, filterHeads, listCell, onLink, onFilterMenu, onListMenu, chartSel, onChartSel, onChartMove, onChartEdit }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ x: 0, y: 0, w: 900, h: 500 });
  const colX = useMemo(() => { const a = [0]; for (let c = 0; c < cols; c++) a.push(a[c] + (sheet.colW[c] ?? DEFAULT_COL_W)); return a; }, [cols, sheet.colW]);
  const rowY = useMemo(() => { const a = [0]; for (let r = 0; r < rows; r++) a.push(a[r] + (hidden?.has(r) ? 0 : sheet.rowH[r] ?? DEFAULT_ROW_H)); return a; }, [rows, sheet.rowH, hidden]);
  const fr = Math.min(sheet.freeze?.rows ?? 0, rows), fc = Math.min(sheet.freeze?.cols ?? 0, cols);
  const find = (arr: number[], v: number) => { let lo = 0, hi = arr.length - 2; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (arr[m] <= v) lo = m; else hi = m - 1; } return lo; };
  useImperativeHandle(ref, () => ({
    focus: () => box.current?.focus({ preventScroll: true }),
    scrollTo: (p) => {
      const el = scroller.current; if (!el) return;
      const z = zoom / 100;
      const left = colX[p.c] * z, right = colX[p.c + 1] * z, top = rowY[p.r] * z, bottom = rowY[p.r + 1] * z;
      const fw = colX[fc] * z, fh = rowY[fr] * z; // what the frozen panes cover
      if (p.c >= fc) { if (left - fw < el.scrollLeft) el.scrollLeft = left - fw; else if (right + HEAD_W > el.scrollLeft + el.clientWidth) el.scrollLeft = right + HEAD_W - el.clientWidth; }
      if (p.r >= fr) { if (top - fh < el.scrollTop) el.scrollTop = top - fh; else if (bottom + HEAD_H > el.scrollTop + el.clientHeight) el.scrollTop = bottom + HEAD_H - el.clientHeight; }
    },
  }), [colX, rowY, zoom, fr, fc]);
  useLayoutEffect(() => {
    const el = scroller.current; if (!el) return;
    const read = () => setScroll({ x: el.scrollLeft, y: el.scrollTop, w: el.clientWidth, h: el.clientHeight });
    read();
    const ro = new ResizeObserver(read); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const z = zoom / 100;
  const r0 = Math.max(0, find(rowY, scroll.y / z) - 2), r1 = Math.min(rows - 1, find(rowY, (scroll.y + scroll.h) / z) + 2);
  const c0 = Math.max(0, find(colX, scroll.x / z) - 1), c1 = Math.min(cols - 1, find(colX, (scroll.x + scroll.w) / z) + 1);
  const covered = useMemo(() => { const s = new Set<string>(); for (const m of sheet.merges) for (let r = m.r1; r <= m.r2; r++) for (let c = m.c1; c <= m.c2; c++) if (r !== m.r1 || c !== m.c1) s.add(key(r, c)); return s; }, [sheet.merges]);
  const range: Range = { r1: Math.min(sel.anchor.r, sel.focus.r), c1: Math.min(sel.anchor.c, sel.focus.c), r2: Math.max(sel.anchor.r, sel.focus.r), c2: Math.max(sel.anchor.c, sel.focus.c) };
  const rect = (g: Range) => ({ left: colX[g.c1], top: rowY[g.r1], width: colX[g.c2 + 1] - colX[g.c1], height: rowY[g.r2 + 1] - rowY[g.r1] });

  // ---- pointer: select by dragging
  const dragging = useRef<null | 'cells' | 'cols' | 'rows'>(null);
  const cellAt = (e: { clientX: number; clientY: number }): Pos => {
    const el = scroller.current!, b = el.getBoundingClientRect();
    const rx = e.clientX - b.left - HEAD_W * z, ry = e.clientY - b.top - HEAD_H * z; // frozen panes do not scroll
    const x = (rx < colX[fc] * z ? rx : rx + el.scrollLeft) / z, y = (ry < rowY[fr] * z ? ry : ry + el.scrollTop) / z;
    return { r: Math.min(rows - 1, Math.max(0, find(rowY, y))), c: Math.min(cols - 1, Math.max(0, find(colX, x))) };
  };
  const down = (e: React.PointerEvent, kind: 'cells' | 'cols' | 'rows', p: Pos) => {
    if (e.button !== 0) return;
    onChartSel?.(null);
    if (editing) onCommit(editing.pos, editing.text, null);
    box.current?.focus({ preventScroll: true });
    dragging.current = kind;
    (box.current as HTMLElement).setPointerCapture(e.pointerId);
    if (kind === 'cols') onSel({ anchor: e.shiftKey ? sel.anchor : { r: 0, c: p.c }, focus: { r: rows - 1, c: p.c } });
    else if (kind === 'rows') onSel({ anchor: e.shiftKey ? sel.anchor : { r: p.r, c: 0 }, focus: { r: p.r, c: cols - 1 } });
    else onSel({ anchor: e.shiftKey ? sel.anchor : p, focus: p });
  };
  const move = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const p = cellAt(e);
    if (dragging.current === 'cells') onSel({ anchor: sel.anchor, focus: p });
    else if (dragging.current === 'cols') onSel({ anchor: { r: 0, c: sel.anchor.c }, focus: { r: rows - 1, c: p.c } });
    else onSel({ anchor: { r: sel.anchor.r, c: 0 }, focus: { r: p.r, c: cols - 1 } });
  };
  const up = (e: React.PointerEvent) => { dragging.current = null; try { (box.current as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* already released */ } };
  const startResize = (e: React.PointerEvent, kind: 'col' | 'row', i: number) => {
    e.stopPropagation(); e.preventDefault();
    const x0 = kind === 'col' ? e.clientX : e.clientY, size0 = kind === 'col' ? colX[i + 1] - colX[i] : rowY[i + 1] - rowY[i];
    const mv = (m: PointerEvent) => onResize(kind, i, Math.max(kind === 'col' ? 24 : 14, Math.round(size0 + ((kind === 'col' ? m.clientX : m.clientY) - x0) / z)));
    const end = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', end); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', end);
  };

  const spilled = new Set<string>();
  const renderCell = (r: number, c: number): React.ReactNode => {
    const k = key(r, c);
    if (covered.has(k) || spilled.has(k)) return null;
    const cell = sheet.cells[k];
    const m = mergeAt(sheet, r, c);
    const x = colX[c], y = rowY[r];
    let w = m ? colX[m.c2 + 1] - x : colX[c + 1] - x;
    const h = m ? rowY[m.r2 + 1] - y : rowY[r + 1] - y;
    const s = cell?.s;
    const pending = cell?.f !== undefined && (cell.v === null || cell.v === '');
    const text = pending ? `=${cell!.f}` : formatCell(cell);
    const numeric = cell && typeof cell.v === 'number' || (cell && typeof cell.v === 'string' && isNumeric(cell.v) && !cell.f);
    const align = s?.align ?? (numeric ? 'right' : typeof cell?.v === 'boolean' ? 'center' : 'left');
    // text that does not fit runs on over the empty cells beside it (not when wrapped, merged, a number or being edited)
    if (!m && !s?.wrap && align === 'left' && typeof cell?.v === 'string' && !numeric && !cell.f && text !== '' && !(editing && editing.pos.r === r && editing.pos.c === c) && textWidth(text, s) + 14 > w) {
      const limit = c < fc ? fc : cols;
      const need = textWidth(text, s) + 14;
      for (let c2 = c + 1; c2 < limit && w < need; c2++) {
        const nk = key(r, c2), nb = sheet.cells[nk];
        if (covered.has(nk) || (nb && ((nb.v !== null && nb.v !== '') || nb.f !== undefined))) break;
        spilled.add(nk); w += colX[c2 + 1] - colX[c2];
      }
    }
    const bd = s?.bd;
    const va = s?.va;
    const look = cf?.(r, c);
    if (rowY[r + 1] - rowY[r] === 0) return null;
    const style: React.CSSProperties = {
      left: x, top: y, width: w, height: h, textAlign: align, background: look?.fill ?? s?.fill, color: look?.color ?? s?.color ?? (cell?.link ? '#0563c1' : cell?.err ? 'hsl(var(--bad))' : pending ? 'hsl(var(--muted))' : undefined),
      fontWeight: look?.bold || s?.b ? 700 : undefined, fontStyle: s?.i || pending ? 'italic' : undefined, textDecoration: [s?.u || cell?.link ? 'underline' : '', s?.st ? 'line-through' : ''].filter(Boolean).join(' ') || undefined, fontFamily: s?.font ? `"${s.font}", inherit` : undefined, fontSize: s?.size ? `${s.size * (96 / 72)}px` : undefined,
      whiteSpace: s?.wrap ? 'pre-wrap' : 'pre', overflow: 'hidden', textOverflow: s?.wrap ? undefined : 'ellipsis',
      ...(bd ? { borderTop: edgeCss(bd.t), borderLeft: edgeCss(bd.l), borderBottom: edgeCss(bd.b), borderRight: edgeCss(bd.r) } : {}),
      ...(va ? { display: 'flex', flexDirection: 'column', justifyContent: va === 'top' ? 'flex-start' : va === 'middle' ? 'center' : 'flex-end', lineHeight: s?.wrap ? 1.25 : '23px' } : {}),
    };
    return (
      <div key={k} className={`sheet-cell${hitNow === k ? ' sheet-hit-now' : hits?.has(k) ? ' sheet-hit' : ''}`} data-r={r} data-c={c} style={style}
        onPointerDown={(e) => { if (cell?.link && (e.ctrlKey || e.metaKey) && onLink) { e.preventDefault(); onLink(cell.link); return; } down(e, 'cells', spilled.size ? cellAt(e) : { r, c }); }} title={cell?.link ? `${cell.link} (Ctrl+click to open)` : undefined} onContextMenu={(e) => { const p = cellAt(e); context(e, 'cell', p.r, p.c); }} onDoubleClick={(e) => { const p = cellAt(e); if (!editing) setEditing({ pos: p, text: editText(sheet.cells[key(p.r, p.c)]), typed: false }); }}>{va ? <span style={{ overflow: 'hidden', textOverflow: s?.wrap ? undefined : 'ellipsis' }}>{text}</span> : text}{filterHeads && r === filterHeads.r && c >= filterHeads.c1 && c <= filterHeads.c2 && <span role="button" aria-label={`Filter column ${colName(c)}`} className={`sheet-filter-btn${filterHeads.active.has(c) ? ' on' : ''}`} onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); onFilterMenu?.(c, { x: e.clientX, y: e.clientY }); }}>▾</span>}{listCell === k && <span role="button" aria-label="Choose from the list" className="sheet-filter-btn on" onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); onListMenu?.(r, c, { x: e.clientX, y: e.clientY }); }}>▾</span>}</div>
    );
  };
  /** the cells of a block of rows and columns, drawn in one layer */
  const block = (ra: number, rb: number, ca: number, cb: number) => { const out: React.ReactNode[] = []; for (let r = ra; r <= rb; r++) for (let c = ca; c <= cb; c++) out.push(renderCell(r, c)); return out; };
  const context = (e: React.MouseEvent, kind: ContextAt['kind'], r: number, c: number) => {
    if (!onContext) return;
    e.preventDefault();
    if (editing) onCommit(editing.pos, editing.text, null);
    box.current?.focus({ preventScroll: true });
    const inside = r >= range.r1 && r <= range.r2 && c >= range.c1 && c <= range.c2;
    if (kind === 'col') { if (!(c >= range.c1 && c <= range.c2 && range.r1 === 0 && range.r2 === rows - 1)) onSel({ anchor: { r: 0, c }, focus: { r: rows - 1, c } }); }
    else if (kind === 'row') { if (!(r >= range.r1 && r <= range.r2 && range.c1 === 0 && range.c2 === cols - 1)) onSel({ anchor: { r, c: 0 }, focus: { r, c: cols - 1 } }); }
    else if (!inside) onSel({ anchor: { r, c }, focus: { r, c } });
    onContext({ x: e.clientX, y: e.clientY, kind, r, c });
  };
  const heads: React.ReactNode[] = [];
  const mkHead = (c: number) => <div key={`h${c}`} className={`sheet-head ${c >= range.c1 && c <= range.c2 ? 'on' : ''}`} style={{ left: colX[c], width: colX[c + 1] - colX[c], height: HEAD_H }} onPointerDown={(e) => down(e, 'cols', { r: 0, c })} onContextMenu={(e) => context(e, 'col', 0, c)}>{colName(c)}<span className="sheet-grip-x" onPointerDown={(e) => startResize(e, 'col', c)} /></div>;
  const mkRowHead = (r: number) => <div key={`r${r}`} className={`sheet-head ${r >= range.r1 && r <= range.r2 ? 'on' : ''}`} style={{ top: rowY[r], height: rowY[r + 1] - rowY[r], width: HEAD_W }} onPointerDown={(e) => down(e, 'rows', { r, c: 0 })} onContextMenu={(e) => context(e, 'row', r, 0)}>{r + 1}<span className="sheet-grip-y" onPointerDown={(e) => startResize(e, 'row', r)} /></div>;
  for (let c = c0; c <= c1; c++) heads.push(mkHead(c));
  const rheads: React.ReactNode[] = [];
  for (let r = r0; r <= r1; r++) rheads.push(mkRowHead(r));
  const pinnedHeads = Array.from({ length: fc }, (_, c) => mkHead(c)), pinnedRowHeads = Array.from({ length: fr }, (_, r) => mkRowHead(r));

  const active = sel.focus.r === sel.anchor.r && sel.focus.c === sel.anchor.c ? sel.focus : sel.anchor;
  const am = mergeAt(sheet, active.r, active.c);
  const activeRect = rect(am ?? { r1: active.r, c1: active.c, r2: active.r, c2: active.c });
  const input = useRef<HTMLTextAreaElement>(null);
  // Copy, cut and paste are listened for on the document: the browser aims them at wherever its text caret is (it can sit in a sheet tab after a click), not at the focused grid
  const clip = useRef({ onCopy, onPaste, editing });
  clip.current = { onCopy, onPaste, editing };
  useEffect(() => {
    const mine = () => { const a = document.activeElement; return !!a && (a === box.current || (box.current?.contains(a) ?? false) && !(a instanceof HTMLTextAreaElement || a instanceof HTMLInputElement)); };
    const handle = (e: ClipboardEvent) => {
      if (clip.current.editing || !mine()) return;
      if (e.type === 'paste') { const t = e.clipboardData?.getData('text/plain'); if (t) { clip.current.onPaste(t); e.preventDefault(); } return; }
      const t = clip.current.onCopy(e.type === 'cut');
      if (t !== null) { e.clipboardData?.setData('text/plain', t); e.preventDefault(); }
    };
    for (const n of ['copy', 'cut', 'paste']) document.addEventListener(n, handle as EventListener);
    return () => { for (const n of ['copy', 'cut', 'paste']) document.removeEventListener(n, handle as EventListener); };
  }, []);
  useEffect(() => { if (editing) { const el = input.current; if (el) { el.focus(); if (editing.typed) el.setSelectionRange(el.value.length, el.value.length); else el.select(); } } }, [editing?.pos.r, editing?.pos.c]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- the fill handle: drag the corner of the selection to extend it
  const [fillTo, setFillTo] = useState<Range | null>(null);
  const startFill = (e: React.PointerEvent) => {
    if (e.button !== 0 || !onFill) return;
    e.stopPropagation(); e.preventDefault();
    const src = range;
    const target = (m: { clientX: number; clientY: number }): Range => {
      const p = cellAt(m);
      const dr = p.r > src.r2 ? p.r - src.r2 : p.r < src.r1 ? p.r - src.r1 : 0, dc = p.c > src.c2 ? p.c - src.c2 : p.c < src.c1 ? p.c - src.c1 : 0;
      if (dr === 0 && dc === 0) return src;
      return Math.abs(dr) >= Math.abs(dc) ? { ...src, r1: Math.min(src.r1, p.r), r2: Math.max(src.r2, p.r) } : { ...src, c1: Math.min(src.c1, p.c), c2: Math.max(src.c2, p.c) };
    };
    let last = src;
    const mv = (m: PointerEvent) => { last = target(m); setFillTo(last); };
    const end = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', end); setFillTo(null); if (last !== src) onFill(src, last); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', end);
  };
  const handlePos = { left: colX[range.c2 + 1] - 4, top: rowY[range.r2 + 1] - 4 };
  /** selection, the fill handle and (when it is in this layer) the cell editor */
  const marks = (layer: 'main' | 'top' | 'left' | 'corner') => {
    const regionOf = (r: number, c: number) => (r < fr ? (c < fc ? 'corner' : 'top') : c < fc ? 'left' : 'main');
    const edit = editing && regionOf(editing.pos.r, editing.pos.c) === layer ? editing : null;
    return (
      <>
        <div className="sheet-range" style={rect(range)} />
        <div className="sheet-active" style={activeRect} />
        {fillTo && layer === 'main' && <div className="sheet-fillto" style={rect(fillTo)} />}
        {onFill && regionOf(range.r2, range.c2) === layer && <div className="sheet-fill" aria-label="Fill handle" style={handlePos} onPointerDown={startFill} />}
        {edit && (() => { const g = rect(mergeAt(sheet, edit.pos.r, edit.pos.c) ?? { r1: edit.pos.r, c1: edit.pos.c, r2: edit.pos.r, c2: edit.pos.c }); return (
          <textarea ref={input} aria-label="Cell" className="sheet-edit" style={{ left: g.left, top: g.top, minWidth: g.width, minHeight: g.height }} rows={1} value={edit.text}
            onChange={(e) => setEditing({ ...edit, text: e.target.value })}
            onBlur={() => onCommit(edit.pos, edit.text, null)}
            onKeyDown={(e) => {
              const done = (m: 'down' | 'right' | 'up' | 'left' | null) => { e.preventDefault(); e.stopPropagation(); onCommit(edit.pos, edit.text, m); };
              if (e.key === 'Enter' && !e.altKey) done(e.shiftKey ? 'up' : 'down');
              else if (e.key === 'Tab') done(e.shiftKey ? 'left' : 'right');
              else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setEditing(null); box.current?.focus({ preventScroll: true }); }
              else if (e.key === 'Enter' && e.altKey) { e.preventDefault(); setEditing({ ...edit, text: `${edit.text}\n` }); }
              else if (edit.typed && e.key === 'ArrowDown') done('down'); else if (edit.typed && e.key === 'ArrowUp') done('up');
              else if (edit.typed && e.key === 'ArrowRight' && e.currentTarget.selectionStart === edit.text.length) done('right');
              else if (edit.typed && e.key === 'ArrowLeft' && e.currentTarget.selectionStart === 0) done('left');
            }} />
        ); })()}
      </>
    );
  };
  const dragChart = (e: React.PointerEvent, id: string, mode: 'move' | 'size') => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (editing) onCommit(editing.pos, editing.text, null);
    onChartSel?.(id);
    box.current?.focus({ preventScroll: true });
    const ch = sheet.charts?.find((c) => c.id === id); if (!ch || !onChartMove) return;
    const x0 = e.clientX, y0 = e.clientY; let first = true, moved = false;
    const mv = (m: PointerEvent) => {
      const dx = (m.clientX - x0) / z, dy = (m.clientY - y0) / z;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
      moved = true;
      onChartMove(id, mode === 'move' ? { x: Math.max(0, Math.round(ch.x + dx)), y: Math.max(0, Math.round(ch.y + dy)), w: ch.w, h: ch.h } : { x: ch.x, y: ch.y, w: Math.max(160, Math.round(ch.w + dx)), h: Math.max(120, Math.round(ch.h + dy)) }, first); first = false;
    };
    const end = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', end); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', end);
  };
  const chartLayer = (sheet.charts ?? []).map((ch) => (
    <div key={ch.id} className={`sheet-chart${chartSel === ch.id ? ' sel' : ''}`} data-chart={ch.id} style={{ left: ch.x, top: ch.y, width: ch.w, height: ch.h }} onPointerDown={(e) => dragChart(e, ch.id, 'move')} onDoubleClick={() => onChartEdit?.(ch.id)}>
      <ChartView chart={ch} data={chartData(sheet, ch)} w={ch.w} h={ch.h} />
      {chartSel === ch.id && <span className="sheet-chart-grip" aria-label="Resize chart" onPointerDown={(e) => dragChart(e, ch.id, 'size')} />}
    </div>
  ));
  const fw = colX[fc] * z, fh = rowY[fr] * z;
  const layer = (style: React.CSSProperties, moveX: boolean, moveY: boolean, w: number, h: number, children: React.ReactNode, name: string) => (
    <div className={`sheet-frozen sheet-frozen-${name}`} style={style}>
      <div style={{ transform: `translate(${moveX ? -scroll.x : 0}px, ${moveY ? -scroll.y : 0}px)` }}>
        <div className="sheet-body" style={{ zoom: z, width: w, height: h }}>{children}</div>
      </div>
    </div>
  );

  return (
    <div ref={box} tabIndex={0} role="grid" aria-label="Spreadsheet" aria-rowcount={rows} aria-colcount={cols} className="sheet-wrap"
      onPointerMove={move} onPointerUp={up}
      onKeyDown={(e) => { if (editing) return; if (onKey(e)) e.preventDefault(); }}
>
      <div ref={scroller} className="sheet-scroll" onScroll={(e) => { const t = e.currentTarget; setScroll((s0) => ({ ...s0, x: t.scrollLeft, y: t.scrollTop })); }}>
        <div style={{ width: colX[cols] * z + HEAD_W, height: rowY[rows] * z + HEAD_H, position: 'relative' }}>
          <div style={{ position: 'absolute', left: HEAD_W, top: HEAD_H }}>
            <div className="sheet-body" style={{ zoom: z, width: colX[cols], height: rowY[rows] }}>
              {block(Math.max(r0, fr), r1, Math.max(c0, fc), c1)}
              {chartLayer}
              {marks('main')}
            </div>
          </div>
        </div>
      </div>
      {fr > 0 && layer({ left: HEAD_W, top: HEAD_H, width: Math.max(0, scroll.w - HEAD_W), height: fh }, true, false, colX[cols], rowY[fr], <>{block(0, fr - 1, Math.max(c0, fc), c1)}{marks('top')}</>, 'top')}
      {fc > 0 && layer({ left: HEAD_W, top: HEAD_H, width: fw, height: Math.max(0, scroll.h - HEAD_H) }, false, true, colX[fc], rowY[rows], <>{block(Math.max(r0, fr), r1, 0, fc - 1)}{marks('left')}</>, 'left')}
      {fr > 0 && fc > 0 && layer({ left: HEAD_W, top: HEAD_H, width: fw, height: fh }, false, false, colX[fc], rowY[fr], <>{block(0, fr - 1, 0, fc - 1)}{marks('corner')}</>, 'corner')}
      <div className="sheet-corner" style={{ width: HEAD_W, height: HEAD_H }} onPointerDown={() => onSel({ anchor: { r: 0, c: 0 }, focus: { r: rows - 1, c: cols - 1 } })} />
      <div className="sheet-colheads" style={{ left: HEAD_W, width: Math.max(0, scroll.w - HEAD_W), height: HEAD_H }}>
        <div style={{ transform: `translateX(${-scroll.x}px)` }}><div style={{ zoom: z, position: 'relative', height: HEAD_H }}>{heads}</div></div>
        {fc > 0 && <div className="sheet-pinned" style={{ left: 0, top: 0, width: fw, height: HEAD_H }}><div style={{ zoom: z, position: 'relative', height: HEAD_H }}>{pinnedHeads}</div></div>}
      </div>
      <div className="sheet-rowheads" style={{ top: HEAD_H, height: Math.max(0, scroll.h - HEAD_H), width: HEAD_W }}>
        <div style={{ transform: `translateY(${-scroll.y}px)` }}><div style={{ zoom: z, position: 'relative', width: HEAD_W }}>{rheads}</div></div>
        {fr > 0 && <div className="sheet-pinned" style={{ left: 0, top: 0, width: HEAD_W, height: fh }}><div style={{ zoom: z, position: 'relative', width: HEAD_W }}>{pinnedRowHeads}</div></div>}
      </div>
    </div>
  );
});
