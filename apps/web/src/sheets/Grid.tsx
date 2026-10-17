import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { colName, DEFAULT_COL_W, DEFAULT_ROW_H, isNumeric, key, type Cell, type Range, type Sheet } from './model.ts';
import { formatCell } from './format.ts';
import { mergeAt } from './ops.ts';

export interface Pos { r: number; c: number }
export interface Sel { anchor: Pos; focus: Pos }
export interface GridHandle { focus(): void; scrollTo(p: Pos): void }

const HEAD_W = 46, HEAD_H = 24;
/** the cell's text as it is edited: a formula as "=…", anything else as it would be typed */
export const editText = (cell: Cell | undefined): string => (cell?.f !== undefined ? `=${cell.f}` : cell?.v === null || cell?.v === undefined ? '' : typeof cell.v === 'boolean' ? (cell.v ? 'TRUE' : 'FALSE') : String(cell.v));

interface Props {
  sheet: Sheet; rows: number; cols: number; zoom: number; sel: Sel; onSel(s: Sel): void;
  editing: { pos: Pos; text: string; typed: boolean } | null; setEditing(e: Props['editing']): void; onCommit(pos: Pos, text: string, move: 'down' | 'right' | 'up' | 'left' | null): void;
  onKey(e: React.KeyboardEvent): boolean; onResize(kind: 'col' | 'row', index: number, size: number): void; onFillHandle?(): void;
  onCopy(cut: boolean): string | null; onPaste(text: string): void; readOnly?: boolean;
}

/**
 * The grid: only the rows and columns in view are drawn, so a sheet of tens of thousands of rows scrolls smoothly. Click and drag select, the headers select
 * a whole column or row and their edges resize it. Keyboard and clipboard are handled by the container; typing starts editing the active cell.
 */
export const Grid = forwardRef<GridHandle, Props>(function Grid({ sheet, rows, cols, zoom, sel, onSel, editing, setEditing, onCommit, onKey, onResize, onCopy, onPaste }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ x: 0, y: 0, w: 900, h: 500 });
  const colX = useMemo(() => { const a = [0]; for (let c = 0; c < cols; c++) a.push(a[c] + (sheet.colW[c] ?? DEFAULT_COL_W)); return a; }, [cols, sheet.colW]);
  const rowY = useMemo(() => { const a = [0]; for (let r = 0; r < rows; r++) a.push(a[r] + (sheet.rowH[r] ?? DEFAULT_ROW_H)); return a; }, [rows, sheet.rowH]);
  const find = (arr: number[], v: number) => { let lo = 0, hi = arr.length - 2; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (arr[m] <= v) lo = m; else hi = m - 1; } return lo; };
  useImperativeHandle(ref, () => ({
    focus: () => box.current?.focus({ preventScroll: true }),
    scrollTo: (p) => {
      const el = scroller.current; if (!el) return;
      const z = zoom / 100;
      const left = colX[p.c] * z, right = colX[p.c + 1] * z, top = rowY[p.r] * z, bottom = rowY[p.r + 1] * z;
      if (left < el.scrollLeft) el.scrollLeft = left; else if (right + HEAD_W > el.scrollLeft + el.clientWidth) el.scrollLeft = right + HEAD_W - el.clientWidth;
      if (top < el.scrollTop) el.scrollTop = top; else if (bottom + HEAD_H > el.scrollTop + el.clientHeight) el.scrollTop = bottom + HEAD_H - el.clientHeight;
    },
  }), [colX, rowY, zoom]);
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
    const x = (e.clientX - b.left + el.scrollLeft - HEAD_W * z) / z, y = (e.clientY - b.top + el.scrollTop - HEAD_H * z) / z;
    return { r: Math.min(rows - 1, Math.max(0, find(rowY, y))), c: Math.min(cols - 1, Math.max(0, find(colX, x))) };
  };
  const down = (e: React.PointerEvent, kind: 'cells' | 'cols' | 'rows', p: Pos) => {
    if (e.button !== 0) return;
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

  const cells: React.ReactNode[] = [];
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const k = key(r, c);
      if (covered.has(k)) continue;
      const cell = sheet.cells[k];
      const m = mergeAt(sheet, r, c);
      const x = colX[c], y = rowY[r];
      const w = m ? colX[m.c2 + 1] - x : colX[c + 1] - x, h = m ? rowY[m.r2 + 1] - y : rowY[r + 1] - y;
      const s = cell?.s;
      const pending = cell?.f !== undefined && (cell.v === null || cell.v === '');
      const text = pending ? `=${cell!.f}` : formatCell(cell);
      const numeric = cell && typeof cell.v === 'number' || (cell && typeof cell.v === 'string' && isNumeric(cell.v) && !cell.f);
      const align = s?.align ?? (numeric ? 'right' : typeof cell?.v === 'boolean' ? 'center' : 'left');
      const bg = s?.fill;
      cells.push(
        <div key={k} className="sheet-cell" data-r={r} data-c={c} style={{
          left: x, top: y, width: w, height: h, textAlign: align, background: bg, color: s?.color ?? (cell?.err ? 'hsl(var(--bad))' : pending ? 'hsl(var(--muted))' : undefined),
          fontWeight: s?.b ? 700 : undefined, fontStyle: s?.i || pending ? 'italic' : undefined, textDecoration: s?.u ? 'underline' : undefined, fontFamily: s?.font ? `"${s.font}", inherit` : undefined, fontSize: s?.size ? `${s.size * (96 / 72)}px` : undefined,
          whiteSpace: s?.wrap ? 'pre-wrap' : 'pre', overflow: 'hidden', textOverflow: s?.wrap ? undefined : 'ellipsis',
        }} onPointerDown={(e) => down(e, 'cells', { r, c })} onDoubleClick={() => !editing && setEditing({ pos: { r, c }, text: editText(cell), typed: false })}>{text}</div>,
      );
    }
  }
  const heads: React.ReactNode[] = [];
  for (let c = c0; c <= c1; c++) heads.push(<div key={`h${c}`} className={`sheet-head ${c >= range.c1 && c <= range.c2 ? 'on' : ''}`} style={{ left: colX[c], width: colX[c + 1] - colX[c], height: HEAD_H }} onPointerDown={(e) => down(e, 'cols', { r: 0, c })}>{colName(c)}<span className="sheet-grip-x" onPointerDown={(e) => startResize(e, 'col', c)} /></div>);
  const rheads: React.ReactNode[] = [];
  for (let r = r0; r <= r1; r++) rheads.push(<div key={`r${r}`} className={`sheet-head ${r >= range.r1 && r <= range.r2 ? 'on' : ''}`} style={{ top: rowY[r], height: rowY[r + 1] - rowY[r], width: HEAD_W }} onPointerDown={(e) => down(e, 'rows', { r, c: 0 })}>{r + 1}<span className="sheet-grip-y" onPointerDown={(e) => startResize(e, 'row', r)} /></div>);

  const active = sel.focus.r === sel.anchor.r && sel.focus.c === sel.anchor.c ? sel.focus : sel.anchor;
  const am = mergeAt(sheet, active.r, active.c);
  const activeRect = rect(am ?? { r1: active.r, c1: active.c, r2: active.r, c2: active.c });
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (editing) { const el = input.current; if (el) { el.focus(); if (editing.typed) el.setSelectionRange(el.value.length, el.value.length); else el.select(); } } }, [editing?.pos.r, editing?.pos.c]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={box} tabIndex={0} role="grid" aria-label="Spreadsheet" aria-rowcount={rows} aria-colcount={cols} className="sheet-wrap"
      onPointerMove={move} onPointerUp={up}
      onKeyDown={(e) => { if (editing) return; if (onKey(e)) e.preventDefault(); }}
      onCopy={(e) => { if (editing) return; const t = onCopy(false); if (t !== null) { e.clipboardData.setData('text/plain', t); e.preventDefault(); } }}
      onCut={(e) => { if (editing) return; const t = onCopy(true); if (t !== null) { e.clipboardData.setData('text/plain', t); e.preventDefault(); } }}
      onPaste={(e) => { if (editing) return; const t = e.clipboardData.getData('text/plain'); if (t) { onPaste(t); e.preventDefault(); } }}>
      <div ref={scroller} className="sheet-scroll" onScroll={(e) => { const t = e.currentTarget; setScroll((s0) => ({ ...s0, x: t.scrollLeft, y: t.scrollTop })); }}>
        <div style={{ width: colX[cols] * z + HEAD_W, height: rowY[rows] * z + HEAD_H, position: 'relative' }}>
          <div style={{ position: 'absolute', left: HEAD_W, top: HEAD_H }}>
            <div className="sheet-body" style={{ zoom: z, width: colX[cols], height: rowY[rows] }}>
              {cells}
              <div className="sheet-range" style={rect(range)} />
              <div className="sheet-active" style={activeRect} />
              {editing && (() => { const g = rect(mergeAt(sheet, editing.pos.r, editing.pos.c) ?? { r1: editing.pos.r, c1: editing.pos.c, r2: editing.pos.r, c2: editing.pos.c }); return (
                <textarea ref={input} aria-label="Cell" className="sheet-edit" style={{ left: g.left, top: g.top, minWidth: g.width, minHeight: g.height }} rows={1} value={editing.text}
                  onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                  onBlur={() => onCommit(editing.pos, editing.text, null)}
                  onKeyDown={(e) => {
                    const done = (m: 'down' | 'right' | 'up' | 'left' | null) => { e.preventDefault(); e.stopPropagation(); onCommit(editing.pos, editing.text, m); };
                    if (e.key === 'Enter' && !e.altKey) done(e.shiftKey ? 'up' : 'down');
                    else if (e.key === 'Tab') done(e.shiftKey ? 'left' : 'right');
                    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setEditing(null); box.current?.focus({ preventScroll: true }); }
                    else if (e.key === 'Enter' && e.altKey) { e.preventDefault(); setEditing({ ...editing, text: `${editing.text}\n` }); }
                    else if (editing.typed && e.key === 'ArrowDown') done('down'); else if (editing.typed && e.key === 'ArrowUp') done('up');
                    else if (editing.typed && e.key === 'ArrowRight' && e.currentTarget.selectionStart === editing.text.length) done('right');
                    else if (editing.typed && e.key === 'ArrowLeft' && e.currentTarget.selectionStart === 0) done('left');
                  }} />
              ); })()}
            </div>
          </div>
        </div>
      </div>
      <div className="sheet-corner" style={{ width: HEAD_W, height: HEAD_H }} onPointerDown={() => onSel({ anchor: { r: 0, c: 0 }, focus: { r: rows - 1, c: cols - 1 } })} />
      <div className="sheet-colheads" style={{ left: HEAD_W, width: Math.max(0, scroll.w - HEAD_W), height: HEAD_H }}><div style={{ transform: `translateX(${-scroll.x}px)` }}><div style={{ zoom: z, position: 'relative', height: HEAD_H }}>{heads}</div></div></div>
      <div className="sheet-rowheads" style={{ top: HEAD_H, height: Math.max(0, scroll.h - HEAD_H), width: HEAD_W }}><div style={{ transform: `translateY(${-scroll.y}px)` }}><div style={{ zoom: z, position: 'relative', width: HEAD_W }}>{rheads}</div></div></div>
    </div>
  );
});
