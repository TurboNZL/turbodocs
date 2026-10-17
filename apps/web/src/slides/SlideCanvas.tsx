import { useEffect, useRef } from 'react';
import { defaultTextColor, type Deck, type El, type Frame, type Para, type Slide, type TextEl } from './model.ts';
import { RichText, fillEditable, readParas } from './rich.tsx';
import { fontStack } from '../editor/fonts.ts';

const INSET = { x: 9.6, y: 4.8 };

/** A slide drawn at `scale` (thumbnails, presenting and the editor's canvas share this). Nothing here edits. */
export function SlideStage({ slide, deck, scale, children, className = '' }: { slide: Slide; deck: Deck; scale: number; children?: React.ReactNode; className?: string }) {
  const text = defaultTextColor(slide.bg);
  return (
    <div className={`slide-stage ${className}`} style={{ width: deck.w * scale, height: deck.h * scale }}>
      <div className="slide-paper" style={{ width: deck.w, height: deck.h, transform: `scale(${scale})`, background: slide.bg ?? '#ffffff', color: text, fontFamily: fontStack(deck.font) }}>
        {slide.els.map((e) => <ElementView key={e.id} el={e} deck={deck} />)}
        {children}
      </div>
    </div>
  );
}

const boxStyle = (e: TextEl) => ({
  background: e.fill, border: e.line ? `${Math.max(1, e.lineW ?? 1)}px solid ${e.line}` : undefined,
  borderRadius: e.geometry === 'ellipse' ? '50%' : e.geometry === 'roundRect' ? Math.min(e.w, e.h) * 0.16 : undefined,
});
const justify = (v: TextEl['valign']) => (v === 'middle' ? 'center' : v === 'bottom' ? 'flex-end' : 'flex-start');

export function ElementView({ el, deck }: { el: El; deck: Deck }) {
  const f: React.CSSProperties = { position: 'absolute', left: el.x, top: el.y, width: el.w, height: el.h };
  if (el.kind === 'image') return <img src={el.src} alt={el.alt ?? ''} draggable={false} style={{ ...f, objectFit: 'fill' }} />;
  return <div className="slide-text" style={{ ...f, ...boxStyle(el), display: 'flex', flexDirection: 'column', justifyContent: justify(el.valign), padding: `${INSET.y}px ${INSET.x}px`, boxSizing: 'border-box', overflow: 'hidden' }}><RichText paras={el.paras} font={deck.font} /></div>;
}

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const HANDLES: { h: Handle; x: number; y: number; cursor: string }[] = [
  { h: 'nw', x: 0, y: 0, cursor: 'nwse-resize' }, { h: 'n', x: 0.5, y: 0, cursor: 'ns-resize' }, { h: 'ne', x: 1, y: 0, cursor: 'nesw-resize' }, { h: 'e', x: 1, y: 0.5, cursor: 'ew-resize' },
  { h: 'se', x: 1, y: 1, cursor: 'nwse-resize' }, { h: 's', x: 0.5, y: 1, cursor: 'ns-resize' }, { h: 'sw', x: 0, y: 1, cursor: 'nesw-resize' }, { h: 'w', x: 0, y: 0.5, cursor: 'ew-resize' },
];

export interface EditApi { box: HTMLDivElement | null }

/**
 * The editable slide: click selects, drag moves, the eight handles resize, double-click on a text box edits its text in place (rich text: the toolbar and the usual
 * shortcuts work on the selection). Positions are slide px; the pointer is divided by `scale`, so any zoom is exact.
 */
export function SlideCanvas({ slide, deck, scale, selected, editing, onSelect, onEdit, onFrame, onText, editRef }: {
  slide: Slide; deck: Deck; scale: number; selected: string | null; editing: string | null;
  onSelect(id: string | null): void; onEdit(id: string | null): void; onFrame(id: string, f: Frame, record: boolean): void; onText(id: string, paras: Para[]): void; editRef: React.MutableRefObject<HTMLDivElement | null>;
}) {
  const paper = useRef<HTMLDivElement>(null);
  const text = defaultTextColor(slide.bg);
  const drag = (e: React.PointerEvent, el: El, mode: 'move' | Handle) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (editing === el.id && mode === 'move') return; // moving the text caret, not the box
    onSelect(el.id);
    if (editing) onEdit(null);
    const start = { x: e.clientX, y: e.clientY }, f0: Frame = { x: el.x, y: el.y, w: el.w, h: el.h };
    let moved = false;
    const mv = (m: PointerEvent) => {
      const dx = (m.clientX - start.x) / scale, dy = (m.clientY - start.y) / scale;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 3 / scale) return;
      moved = true;
      let { x, y, w, h } = f0;
      if (mode === 'move') { x += dx; y += dy; }
      else {
        if (mode.includes('e')) w = Math.max(20, f0.w + dx);
        if (mode.includes('s')) h = Math.max(14, f0.h + dy);
        if (mode.includes('w')) { w = Math.max(20, f0.w - dx); x = f0.x + f0.w - w; }
        if (mode.includes('n')) { h = Math.max(14, f0.h - dy); y = f0.y + f0.h - h; }
        if (el.kind === 'image' && m.shiftKey === false && mode.length === 2) { h = (w * f0.h) / f0.w; if (mode.includes('n')) y = f0.y + f0.h - h; }
      }
      onFrame(el.id, { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }, false);
    };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); if (moved) onFrame(el.id, { x: 0, y: 0, w: 0, h: 0 }, true); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };
  return (
    <SlideStage slide={slide} deck={deck} scale={scale}>
      <div ref={paper} style={{ position: 'absolute', inset: 0 }} onPointerDown={() => { onSelect(null); onEdit(null); }}>
        {slide.els.map((el) => {
          const isSel = selected === el.id, isEdit = editing === el.id;
          const f: React.CSSProperties = { position: 'absolute', left: el.x, top: el.y, width: el.w, height: el.h };
          return (
            <div key={el.id} data-el={el.id} style={{ ...f, cursor: isEdit ? 'text' : 'move' }} className={isSel ? 'slide-sel' : ''} onPointerDown={(e) => drag(e, el, 'move')}
              onDoubleClick={() => { if (el.kind === 'text') { onSelect(el.id); onEdit(el.id); } }}>
              {el.kind === 'image'
                ? <img src={el.src} alt={el.alt ?? ''} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'fill', pointerEvents: 'none' }} />
                : isEdit
                  ? <Editable el={el} deck={deck} text={text} editRef={editRef} onText={onText} />
                  : <div className="slide-text" style={{ ...boxStyle(el), width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: justify(el.valign), padding: `${INSET.y}px ${INSET.x}px`, boxSizing: 'border-box', overflow: 'hidden' }}><RichText paras={el.paras} font={deck.font} /></div>}
              {isSel && !isEdit && HANDLES.map((h) => (
                <span key={h.h} className="slide-handle" style={{ left: `${h.x * 100}%`, top: `${h.y * 100}%`, cursor: h.cursor, transform: `translate(-50%, -50%) scale(${1 / scale})` }} onPointerDown={(e) => drag(e, el, h.h)} />
              ))}
            </div>
          );
        })}
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
    <div className="slide-text slide-editing" style={{ ...boxStyle(el), width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: justify(el.valign), padding: `${INSET.y}px ${INSET.x}px`, boxSizing: 'border-box', overflow: 'auto' }} onPointerDown={(e) => e.stopPropagation()}>
      <div ref={ref} contentEditable suppressContentEditableWarning role="textbox" aria-label="Slide text" aria-multiline="true" spellCheck style={{ outline: 'none', color: text, fontSize: first * (96 / 72) }} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); commit(); (e.currentTarget as HTMLElement).blur(); } e.stopPropagation(); }} />
    </div>
  );
}
