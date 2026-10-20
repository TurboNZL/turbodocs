import { useEffect, useRef, useState } from 'react';
import { bounds, defaultTextColor, type ChartEl, type Deck, type El, type Frame, type ImageEl, type LineEl, type Para, type Slide, type TableEl, type TextEl } from './model.ts';
import { RichText, fillEditable, readParas } from './rich.tsx';
import { isSvgShape, shapePath } from './shapes.ts';
import { cellTint, isCovered, mergeOf } from './tableOps.ts';
import { ChartView } from '../sheets/ChartView.tsx';
import { fontStack } from '../editor/fonts.ts';

const INSET = { x: 9.6, y: 4.8 };

/** A slide drawn at `scale` (thumbnails, presenting and the editor's canvas share this). Nothing here edits. */
export function SlideStage({ slide, deck, scale, children, className = '', hints = false }: { slide: Slide; deck: Deck; scale: number; children?: React.ReactNode; className?: string; hints?: boolean }) {
  const text = defaultTextColor(slide.bg);
  return (
    <div className={`slide-stage ${className}`} style={{ width: deck.w * scale, height: deck.h * scale }}>
      <div className="slide-paper" style={{ width: deck.w, height: deck.h, transform: `scale(${scale})`, background: slide.bg ?? '#ffffff', color: text, fontFamily: fontStack(deck.font) }}>
        {slide.els.map((e) => <ElementView key={e.id} el={e} deck={deck} dark={text === '#ffffff'} hints={hints} />)}
        {children}
      </div>
    </div>
  );
}

const boxStyle = (e: TextEl) => ({
  background: isSvgShape(e.geometry) ? undefined : e.fill, border: !isSvgShape(e.geometry) && e.line ? `${Math.max(1, e.lineW ?? 1)}px solid ${e.line}` : undefined,
  borderRadius: e.geometry === 'ellipse' ? '50%' : e.geometry === 'roundRect' ? Math.min(e.w, e.h) * 0.16 : undefined,
});
const justify = (v: TextEl['valign']) => (v === 'middle' ? 'center' : v === 'bottom' ? 'flex-end' : 'flex-start');
const framed = (el: El): React.CSSProperties => ({ position: 'absolute', left: el.x, top: el.y, width: el.w, height: el.h, ...(el.rot ? { transform: `rotate(${el.rot}deg)` } : {}) });

/** the outline of a preset shape (triangle, star, arrow ...), drawn behind the text */
function ShapeSvg({ el }: { el: TextEl }) {
  if (!isSvgShape(el.geometry)) return null;
  return <svg width={el.w} height={el.h} style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden><path d={shapePath(el.geometry!, el.w, el.h)} fill={el.fill ?? 'none'} stroke={el.line ?? 'none'} strokeWidth={el.line ? Math.max(1, el.lineW ?? 1) : 0} strokeLinejoin="round" /></svg>;
}

/** a picture, cut down to its crop */
export function Pic({ el }: { el: ImageEl }) {
  const c = el.crop;
  if (!c || (!c.l && !c.t && !c.r && !c.b)) return <img src={el.src} alt={el.alt ?? ''} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block', pointerEvents: 'none' }} />;
  const kw = Math.max(0.05, 1 - c.l - c.r), kh = Math.max(0.05, 1 - c.t - c.b);
  return <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}><img src={el.src} alt={el.alt ?? ''} draggable={false} style={{ position: 'absolute', maxWidth: 'none', width: el.w / kw, height: el.h / kh, left: (-c.l * el.w) / kw, top: (-c.t * el.h) / kh, pointerEvents: 'none' }} /></div>;
}
/** a chart on a slide, in the slide's own text colour */
export function SlideChart({ el, dark }: { el: ChartEl; dark: boolean }) {
  const fg = dark ? '#ffffff' : '#000000';
  return <ChartView chart={el} data={{ cats: el.cats, series: el.series }} w={el.w} h={el.h} ink={{ fg, muted: dark ? '#ffffffb3' : '#000000a6', line: dark ? '#ffffff33' : '#00000022', bg: 'none' }} />;
}

export function LineView({ el }: { el: LineEl }) {
  const y1 = el.flipV ? el.h : 0, y2 = el.flipV ? 0 : el.h;
  const mid = `m${el.id}`;
  return (
    <svg width={Math.max(1, el.w)} height={Math.max(1, el.h)} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
      <defs><marker id={mid} markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M0,0 L4,2 L0,4 Z" fill={el.color} /></marker></defs>
      <line x1={0} y1={y1} x2={el.w} y2={y2} stroke={el.color} strokeWidth={el.width} strokeDasharray={el.dash ? `${el.width * 3} ${el.width * 2}` : undefined} strokeLinecap="butt" markerStart={el.head ? `url(#${mid})` : undefined} markerEnd={el.tail ? `url(#${mid})` : undefined} />
      <line x1={0} y1={y1} x2={el.w} y2={y2} stroke="transparent" strokeWidth={Math.max(14, el.width)} style={{ pointerEvents: 'stroke' }} />
    </svg>
  );
}

export function TableView({ el, dark, active, editing, onCell, onEditCell, onCommitCell }: {
  el: TableEl; dark: boolean; active?: { r: number; c: number } | null; editing?: { r: number; c: number } | null;
  onCell?(r: number, c: number): void; onEditCell?(r: number, c: number): void; onCommitCell?(r: number, c: number, text: string, next?: 'right' | 'cancel'): void;
}) {
  return (
    <table className="slide-table" style={{ width: el.w, height: el.h, tableLayout: 'fixed', borderCollapse: 'collapse' }}>
      <colgroup>{el.cols.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
      <tbody>
        {el.cells.map((row, r) => (
          <tr key={r} style={{ height: el.rows[r] }}>
            {row.map((cell, c) => {
              if (isCovered(el, r, c)) return null;
              const mg = mergeOf(el, r, c);
              const head = el.header && r === 0;
              const fill = cell.fill ?? cellTint(el, r, dark);
              const color = cell.color ?? (head ? defaultTextColor(fill) : undefined);
              const isEdit = editing?.r === r && editing.c === c;
              return (
                <td key={c} colSpan={mg?.cs} rowSpan={mg?.rs} data-active={active?.r === r && active.c === c ? '1' : undefined} data-cell={`${r},${c}`}
                  style={{ border: `1px solid ${el.border}`, background: fill, color, fontWeight: cell.b || head ? 700 : 400, fontStyle: cell.i ? 'italic' : 'normal', textAlign: cell.align ?? 'left', fontSize: ((cell.size ?? 18) * 96) / 72, padding: '4px 10px', lineHeight: 1.2 }}
                  onPointerDown={onCell ? () => onCell(r, c) : undefined} onDoubleClick={onEditCell ? () => onEditCell(r, c) : undefined}>
                  {isEdit && onCommitCell
                    ? <CellEditor text={cell.t} onDone={(t, next) => onCommitCell(r, c, t, next)} />
                    : cell.t === '' ? <br /> : cell.t}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CellEditor({ text, onDone }: { text: string; onDone(t: string, next?: 'right' | 'cancel'): void }) {
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  useEffect(() => {
    const d = ref.current!; d.textContent = text; d.focus();
    const r = document.createRange(); r.selectNodeContents(d); const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const finish = (next?: 'right' | 'cancel') => { if (done.current) return; done.current = true; onDone(next === 'cancel' ? text : (ref.current?.innerText ?? '').replace(/\n$/, ''), next); };
  return <div ref={ref} contentEditable="plaintext-only" suppressContentEditableWarning role="textbox" aria-label="Table cell" style={{ outline: 'none', minHeight: '1.2em' }} onPointerDown={(e) => e.stopPropagation()} onBlur={() => finish()}
    onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); finish('cancel'); } else if (e.key === 'Tab') { e.preventDefault(); finish('right'); } else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finish(); } }} />;
}

/** a text box as the show draws it; `hint` is the placeholder text for an empty box (editing only) */
function TextBody({ el, deck, hint }: { el: TextEl; deck: Deck; hint?: boolean }) {
  const empty = !el.paras.some((p) => p.runs.some((r) => r.text !== ''));
  return (
    <>
      <ShapeSvg el={el} />
      <div className="slide-text" style={{ ...boxStyle(el), position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: justify(el.valign), padding: `${INSET.y}px ${INSET.x}px`, boxSizing: 'border-box', overflow: 'hidden' }}>
        {!(hint && empty && el.ph) && <RichText paras={el.paras} font={deck.font} />}
      </div>
      {hint && empty && el.ph && <div className="slide-hint" style={{ fontSize: ((el.paras[0]?.runs[0]?.size ?? 18) * 96) / 72, textAlign: el.paras[0]?.align ?? 'left', display: 'flex', flexDirection: 'column', justifyContent: justify(el.valign), fontFamily: fontStack(deck.font) }}>{el.ph}</div>}
    </>
  );
}

export function ElementView({ el, deck, dark, hints = false }: { el: El; deck: Deck; dark: boolean; hints?: boolean }) {
  if (el.kind === 'image') return <div style={framed(el)}><Pic el={el} /></div>;
  if (el.kind === 'chart') return <div style={framed(el)}><SlideChart el={el} dark={dark} /></div>;
  if (el.kind === 'line') return <div style={framed(el)}><LineView el={el} /></div>;
  if (el.kind === 'table') return <div style={framed(el)}><TableView el={el} dark={dark} /></div>;
  return <div style={framed(el)}><TextBody el={el} deck={deck} hint={hints} /></div>;
}

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const HANDLES: { h: Handle; x: number; y: number; cursor: string }[] = [
  { h: 'nw', x: 0, y: 0, cursor: 'nwse-resize' }, { h: 'n', x: 0.5, y: 0, cursor: 'ns-resize' }, { h: 'ne', x: 1, y: 0, cursor: 'nesw-resize' }, { h: 'e', x: 1, y: 0.5, cursor: 'ew-resize' },
  { h: 'se', x: 1, y: 1, cursor: 'nwse-resize' }, { h: 's', x: 0.5, y: 1, cursor: 'ns-resize' }, { h: 'sw', x: 0, y: 1, cursor: 'nesw-resize' }, { h: 'w', x: 0, y: 0.5, cursor: 'ew-resize' },
];

export interface EditApi { box: HTMLDivElement | null }
/** a change to some elements (position, size, rotation, line ends); the first one of a drag is the one undo remembers */
export type Patch = Record<string, Partial<Frame> & { rot?: number; flipV?: boolean; head?: boolean; tail?: boolean }>;
export interface CellRef { id: string; r: number; c: number }

const rotate = (x: number, y: number, deg: number): [number, number] => { const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; };
const SNAP = 6;

/**
 * The editable slide: click selects (shift adds, a drag on the background selects a rectangle of boxes), drag moves with guides that snap to the slide and to the other
 * boxes, the eight handles resize, the round handle turns, double-click on a text box edits its text in place (rich text: the toolbar and the usual shortcuts work on the
 * selection) and on a table cell edits the cell. Positions are slide px; the pointer is divided by `scale`, so any zoom is exact.
 */
export function SlideCanvas({ onContext, onEditChart, slide, deck, scale, selected, editing, cell, editCell, onSelect, onEdit, onPatch, onText, onCell, onEditCell, onCommitCell, editRef }: {
  onContext?(c: { x: number; y: number; id: string | null; cell: CellRef | null }): void; onEditChart?(id: string): void; slide: Slide; deck: Deck; scale: number; selected: string[]; editing: string | null; cell: CellRef | null; editCell: CellRef | null;
  onSelect(ids: string[]): void; onEdit(id: string | null): void; onPatch(p: Patch, first: boolean): void; onText(id: string, paras: Para[]): void;
  onCell(c: CellRef | null): void; onEditCell(c: CellRef | null): void; onCommitCell(c: CellRef, text: string, next?: 'right' | 'cancel'): void; editRef: React.MutableRefObject<HTMLDivElement | null>;
}) {
  const paper = useRef<HTMLDivElement>(null);
  const text = defaultTextColor(slide.bg);
  const [guides, setGuides] = useState<{ x?: number; y?: number }[]>([]);
  const [marquee, setMarquee] = useState<Frame | null>(null);
  const byId = (id: string) => slide.els.find((e) => e.id === id);
  const toSlide = (e: { clientX: number; clientY: number }) => { const b = paper.current!.getBoundingClientRect(); return { x: (e.clientX - b.left) / scale, y: (e.clientY - b.top) / scale }; };

  const drag = (e: React.PointerEvent, el: El, mode: 'move' | Handle | 'rot' | 'p1' | 'p2') => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (editing === el.id && mode === 'move') return; // moving the text caret, not the box
    if (editCell?.id === el.id && mode === 'move') return;
    if (mode === 'move' && e.shiftKey) { onSelect(selected.includes(el.id) ? selected.filter((i) => i !== el.id) : [...selected, el.id]); return; }
    let ids = selected;
    if (mode !== 'move' || !selected.includes(el.id)) { ids = [el.id]; onSelect(ids); }
    if (editing) onEdit(null);
    if (editCell) onEditCell(null);
    const start = { x: e.clientX, y: e.clientY };
    const f0: Record<string, El> = {}; for (const id of ids) { const x = byId(id); if (x) f0[id] = x; }
    const others = slide.els.filter((x) => !ids.includes(x.id));
    let moved = false, first = true;
    const send = (p: Patch) => { onPatch(p, first); first = false; };
    const box = (e.currentTarget as HTMLElement).closest('[data-el]') as HTMLElement | null;
    const mv = (m: PointerEvent) => {
      const dx = (m.clientX - start.x) / scale, dy = (m.clientY - start.y) / scale;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 3 / scale) return;
      moved = true;
      if (mode === 'move') {
        // snap the group's box (left / middle / right, top / middle / bottom) to the slide and to the other boxes
        const fs = Object.values(f0).map(bounds), ob = others.map(bounds);
        const bb = { x1: Math.min(...fs.map((f) => f.x)) + dx, y1: Math.min(...fs.map((f) => f.y)) + dy, x2: Math.max(...fs.map((f) => f.x + f.w)) + dx, y2: Math.max(...fs.map((f) => f.y + f.h)) + dy };
        const xs = [0, deck.w / 2, deck.w, ...ob.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])], ys = [0, deck.h / 2, deck.h, ...ob.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h])];
        const best = (mine: number[], theirs: number[]) => { let d = Infinity, at = 0; for (const a of mine) for (const b of theirs) if (Math.abs(b - a) < Math.abs(d)) { d = b - a; at = b; } return Math.abs(d) <= SNAP / scale && !m.altKey ? { d, at } : null; };
        const sx = best([bb.x1, (bb.x1 + bb.x2) / 2, bb.x2], xs), sy = best([bb.y1, (bb.y1 + bb.y2) / 2, bb.y2], ys);
        const ox = dx + (sx?.d ?? 0), oy = dy + (sy?.d ?? 0);
        setGuides([...(sx ? [{ x: sx.at }] : []), ...(sy ? [{ y: sy.at }] : [])]);
        const p: Patch = {}; for (const [id, f] of Object.entries(f0)) p[id] = { x: Math.round(f.x + ox), y: Math.round(f.y + oy) };
        send(p); return;
      }
      const f = f0[el.id];
      if (mode === 'rot') {
        const b = box!.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
        let deg = (Math.atan2(m.clientY - cy, m.clientX - cx) * 180) / Math.PI + 90;
        deg = m.shiftKey ? Math.round(deg / 15) * 15 : Math.round(deg);
        deg = ((deg % 360) + 360) % 360; if (Math.min(deg, 360 - deg) < 2) deg = 0;
        send({ [el.id]: { rot: deg } }); return;
      }
      if ((mode === 'p1' || mode === 'p2') && f.kind === 'line') {
        const a = { x: f.x, y: f.flipV ? f.y + f.h : f.y }, z = { x: f.x + f.w, y: f.flipV ? f.y : f.y + f.h };
        const mover = mode === 'p1' ? a : z, fixed = mode === 'p1' ? z : a;
        const np = { x: Math.round(mover.x + dx), y: Math.round(mover.y + dy) };
        const swapped = mode === 'p1' ? np.x > fixed.x : np.x < fixed.x;
        const L = mode === 'p1' ? (swapped ? fixed : np) : (swapped ? np : fixed), Rr = mode === 'p1' ? (swapped ? np : fixed) : (swapped ? fixed : np);
        send({ [el.id]: { x: L.x, y: Math.min(L.y, Rr.y), w: Rr.x - L.x, h: Math.abs(Rr.y - L.y), flipV: Rr.y < L.y, head: swapped ? f.tail : f.head, tail: swapped ? f.head : f.tail } });
        return;
      }
      // resize in the box's own axes, then move the box so the opposite edge stays where it was on the slide
      const [ldx, ldy] = rotate(dx, dy, -(f.rot ?? 0));
      const hd = mode as Handle;
      let { w, h } = f;
      const minW = f.kind === 'line' ? 0 : 20, minH = f.kind === 'line' ? 0 : 14;
      if (hd.includes('e')) w = Math.max(minW, f.w + ldx);
      if (hd.includes('s')) h = Math.max(minH, f.h + ldy);
      if (hd.includes('w')) w = Math.max(minW, f.w - ldx);
      if (hd.includes('n')) h = Math.max(minH, f.h - ldy);
      if (f.kind === 'image' && !m.shiftKey && hd.length === 2) h = (w * f.h) / f.w;
      const ax = hd.includes('w') ? 1 : hd.includes('e') ? 0 : 0.5, ay = hd.includes('n') ? 1 : hd.includes('s') ? 0 : 0.5;
      const [ox, oy] = rotate(f.w * (ax - 0.5), f.h * (ay - 0.5), f.rot ?? 0), [qx, qy] = rotate(w * (ax - 0.5), h * (ay - 0.5), f.rot ?? 0);
      const nx = f.x + f.w / 2 + ox - qx - w / 2, ny = f.y + f.h / 2 + oy - qy - h / 2;
      send({ [el.id]: { x: Math.round(nx), y: Math.round(ny), w: Math.round(w), h: Math.round(h) } });
    };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); setGuides([]); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };

  const background = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    onEdit(null); onEditCell(null); onCell(null);
    const a = toSlide(e); const base = e.shiftKey ? selected : [];
    if (!e.shiftKey) onSelect([]);
    const mv = (m: PointerEvent) => {
      const b = toSlide(m);
      const r = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
      if (r.w + r.h < 4) return;
      setMarquee(r);
      const hit = slide.els.filter((el) => { const q = bounds(el); return q.x < r.x + r.w && q.x + q.w > r.x && q.y < r.y + r.h && q.y + q.h > r.y; }).map((el) => el.id);
      onSelect([...new Set([...base, ...hit])]);
    };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); setMarquee(null); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };

  const single = selected.length === 1 ? byId(selected[0]) : undefined;
  return (
    <SlideStage slide={slide} deck={deck} scale={scale}>
      <div ref={paper} style={{ position: 'absolute', inset: 0 }} onPointerDown={background} onContextMenu={(e) => {
        e.preventDefault();
        const box = (e.target as HTMLElement).closest('[data-el]') as HTMLElement | null, td = (e.target as HTMLElement).closest('td[data-cell]') as HTMLElement | null;
        const [r, c] = td ? td.dataset.cell!.split(',').map(Number) : [0, 0];
        onContext?.({ x: e.clientX, y: e.clientY, id: box?.dataset.el ?? null, cell: box && td ? { id: box.dataset.el!, r, c } : null });
      }}>
        {slide.els.map((el) => {
          const isSel = selected.includes(el.id), isEdit = editing === el.id;
          return (
            <div key={el.id} data-el={el.id} style={{ ...framed(el), cursor: isEdit ? 'text' : 'move' }} className={isSel && el.kind !== 'line' ? 'slide-sel' : ''} onPointerDown={(e) => drag(e, el, 'move')}
              onDoubleClick={() => { if (el.kind === 'text') { onSelect([el.id]); onEdit(el.id); } else if (el.kind === 'chart') onEditChart?.(el.id); }}>
              {el.kind === 'image' && <Pic el={el} />}
              {el.kind === 'chart' && <div style={{ pointerEvents: 'none' }}><SlideChart el={el} dark={text === '#ffffff'} /></div>}
              {el.kind === 'line' && <LineView el={el} />}
              {el.kind === 'table' && (
                <TableView el={el} dark={text === '#ffffff'} active={cell?.id === el.id ? cell : null} editing={editCell?.id === el.id ? editCell : null}
                  onCell={(r, c) => onCell({ id: el.id, r, c })} onEditCell={(r, c) => { onSelect([el.id]); onEditCell({ id: el.id, r, c }); }} onCommitCell={(r, c, t, next) => onCommitCell({ id: el.id, r, c }, t, next)} />
              )}
              {el.kind === 'text' && (isEdit
                ? <Editable el={el} deck={deck} text={text} editRef={editRef} onText={onText} />
                : <TextBody el={el} deck={deck} hint />)}
              {isSel && single?.id === el.id && !isEdit && !editCell && el.kind !== 'line' && <>
                {HANDLES.map((h) => <span key={h.h} className="slide-handle" style={{ left: `${h.x * 100}%`, top: `${h.y * 100}%`, cursor: h.cursor, transform: `translate(-50%, -50%) scale(${1 / scale})` }} onPointerDown={(e) => drag(e, el, h.h)} />)}
                <span className="slide-rot" aria-label="Rotate" title="Rotate (Shift snaps to 15°)" style={{ left: '50%', top: 0, transform: `translate(-50%, ${-26 / scale - 7}px) scale(${1 / scale})` }} onPointerDown={(e) => drag(e, el, 'rot')} />
              </>}
              {isSel && single?.id === el.id && el.kind === 'line' && <>
                <span className="slide-handle" aria-label="Line start" style={{ left: 0, top: el.flipV ? '100%' : 0, cursor: 'crosshair', transform: `translate(-50%, -50%) scale(${1 / scale})` }} onPointerDown={(e) => drag(e, el, 'p1')} />
                <span className="slide-handle" aria-label="Line end" style={{ left: '100%', top: el.flipV ? 0 : '100%', cursor: 'crosshair', transform: `translate(-50%, -50%) scale(${1 / scale})` }} onPointerDown={(e) => drag(e, el, 'p2')} />
              </>}
              {isSel && el.kind === 'line' && selected.length > 1 && <span style={{ position: 'absolute', inset: -3, outline: '2px solid hsl(var(--accent))' }} />}
            </div>
          );
        })}
        {guides.map((g, i) => (g.x !== undefined ? <div key={i} className="slide-guide" style={{ left: g.x - 0.5 / scale, top: 0, width: 1 / scale, height: deck.h }} /> : <div key={i} className="slide-guide" style={{ top: g.y! - 0.5 / scale, left: 0, height: 1 / scale, width: deck.w }} />))}
        {marquee && <div className="slide-marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />}
      </div>
    </SlideStage>
  );
}

function Editable({ el, deck, text, editRef, onText }: { el: TextEl; deck: Deck; text: string; editRef: React.MutableRefObject<HTMLDivElement | null>; onText(id: string, paras: Para[]): void }) {
  const ref = useRef<HTMLDivElement>(null);
  const first = el.paras[0]?.runs[0]?.size ?? 18;
  useEffect(() => {
    const d = ref.current!; editRef.current = d;
    fillEditable(d, el.paras, deck.font);
    d.focus();
    const sel = window.getSelection(); const r = document.createRange(); r.selectNodeContents(d); sel?.removeAllRanges(); sel?.addRange(r);
    document.execCommand('styleWithCSS', false, 'true');
    return () => { editRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const commit = () => { const d = ref.current; if (d) onText(el.id, readParas(d, deck.font, first)); };
  return (
    <>
      <ShapeSvg el={el} />
      <div className="slide-text slide-editing" style={{ ...boxStyle(el), position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: justify(el.valign), padding: `${INSET.y}px ${INSET.x}px`, boxSizing: 'border-box', overflow: 'auto' }} onPointerDown={(e) => e.stopPropagation()}>
        <div ref={ref} contentEditable suppressContentEditableWarning role="textbox" aria-label="Slide text" aria-multiline="true" spellCheck style={{ outline: 'none', color: text, fontSize: first * (96 / 72) }} onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); commit(); (e.currentTarget as HTMLElement).blur(); } e.stopPropagation(); }} />
      </div>
    </>
  );
}
