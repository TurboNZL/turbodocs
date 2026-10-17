import { useEffect, useRef, useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';

export interface Crop { l: number; t: number; r: number; b: number }
const NO_CROP: Crop = { l: 0, t: 0, r: 0, b: 0 };
const MIN = 16;

/**
 * A picture in the document. Click selects it and shows four handles (drag a corner to resize, the shape stays); double-click, or Format > Image > Crop,
 * shows the whole picture with four edges to drag. A crop never changes the picture itself: it is kept as `crop` fractions and written to the file as Word's own
 * crop (`a:srcRect`), so it can be undone later.
 */
export function ImageView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const a = node.attrs as { src: string; alt?: string; width?: number; height?: number; crop?: Crop | null };
  const crop = a.crop ?? NO_CROP;
  const w = a.width || 240, h = a.height || 160;
  const [live, setLive] = useState<{ w: number; h: number } | null>(null);
  const [cropping, setCropping] = useState(false);
  const [draft, setDraft] = useState<Crop>(crop);
  const root = useRef<HTMLSpanElement>(null);
  const cw = live?.w ?? w, ch = live?.h ?? h;

  // Format > Image > Crop acts on the selected picture
  useEffect(() => {
    if (!selected) return;
    const start = () => { setDraft(crop); setCropping(true); };
    window.addEventListener('turbodocs:crop-image', start);
    return () => window.removeEventListener('turbodocs:crop-image', start);
  }, [selected, crop.l, crop.t, crop.r, crop.b]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!selected) setCropping(false); }, [selected]);

  // how many screen pixels one document pixel is (the canvas can be zoomed)
  const scale = () => { const r = root.current?.getBoundingClientRect(); return r && cw ? r.width / cw || 1 : 1; };

  const dragResize = (e: React.PointerEvent, right: boolean) => {
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, sc = scale(), aspect = w / h;
    let last = { w, h };
    const move = (m: PointerEvent) => {
      const nw = Math.max(MIN, Math.round(w + ((m.clientX - x0) / sc) * (right ? 1 : -1)));
      last = { w: nw, h: Math.max(MIN, Math.round(nw / aspect)) };
      setLive(last);
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); setLive(null); updateAttributes({ width: last.w, height: last.h }); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  // ---- crop mode: the whole picture is W x H; the kept part is the rectangle between the four edges
  const keepW = 1 - crop.l - crop.r, keepH = 1 - crop.t - crop.b;
  const fullW = w / keepW, fullH = h / keepH;
  const dragEdge = (e: React.PointerEvent, edge: keyof Crop) => {
    e.preventDefault(); e.stopPropagation();
    const start = { x: e.clientX, y: e.clientY }, sc = scale(), from = draft;
    const move = (m: PointerEvent) => {
      const dx = (m.clientX - start.x) / sc / fullW, dy = (m.clientY - start.y) / sc / fullH;
      const d = { ...from };
      if (edge === 'l') d.l = Math.min(1 - from.r - MIN / fullW, Math.max(0, from.l + dx));
      if (edge === 'r') d.r = Math.min(1 - from.l - MIN / fullW, Math.max(0, from.r - dx));
      if (edge === 't') d.t = Math.min(1 - from.b - MIN / fullH, Math.max(0, from.t + dy));
      if (edge === 'b') d.b = Math.min(1 - from.t - MIN / fullH, Math.max(0, from.b - dy));
      setDraft(d);
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  const applyCrop = () => {
    const kw = 1 - draft.l - draft.r, kh = 1 - draft.t - draft.b;
    const same = draft.l === 0 && draft.t === 0 && draft.r === 0 && draft.b === 0;
    updateAttributes({ crop: same ? null : { l: round(draft.l), t: round(draft.t), r: round(draft.r), b: round(draft.b) }, width: Math.round(fullW * kw), height: Math.round(fullH * kh) });
    setCropping(false);
  };
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  if (cropping) {
    const L = draft.l * fullW, T = draft.t * fullH, Wk = (1 - draft.l - draft.r) * fullW, Hk = (1 - draft.t - draft.b) * fullH;
    return (
      <NodeViewWrapper as="span" className="img-view img-cropping" contentEditable={false} data-drag-handle>
        <span ref={root} className="img-box" style={{ width: fullW, height: fullH }}>
          <img src={a.src} alt="" draggable={false} style={{ width: fullW, height: fullH, opacity: 0.35 }} />
          <span className="img-keep" style={{ left: L, top: T, width: Wk, height: Hk }}>
            <img src={a.src} alt="" draggable={false} style={{ width: fullW, height: fullH, left: -L, top: -T }} />
            <span className="img-edge img-edge-l" onPointerDown={(e) => dragEdge(e, 'l')} />
            <span className="img-edge img-edge-r" onPointerDown={(e) => dragEdge(e, 'r')} />
            <span className="img-edge img-edge-t" onPointerDown={(e) => dragEdge(e, 't')} />
            <span className="img-edge img-edge-b" onPointerDown={(e) => dragEdge(e, 'b')} />
          </span>
        </span>
        <span className="img-bar bt-menu" onMouseDown={stop} onClick={stop}>
          <button type="button" className="btn btn-accent !px-2 !py-0.5 text-xs" onClick={applyCrop}>Crop</button>
          <button type="button" className="btn !px-2 !py-0.5 text-xs" onClick={() => setDraft(NO_CROP)}>Reset</button>
          <button type="button" className="btn btn-ghost !px-2 !py-0.5 text-xs" onClick={() => setCropping(false)}>Cancel</button>
        </span>
      </NodeViewWrapper>
    );
  }
  const iw = cw / keepW, ih = ch / keepH;
  return (
    <NodeViewWrapper as="span" className={`img-view ${selected ? 'img-selected' : ''}`} contentEditable={false} data-drag-handle>
      <span ref={root} className="img-box" style={{ width: cw, height: ch }} onDoubleClick={() => { if (editor.isEditable) { setDraft(crop); setCropping(true); } }}>
        <img src={a.src} alt={a.alt ?? ''} draggable={false} style={{ width: iw, height: ih, left: -crop.l * iw, top: -crop.t * ih }} />
        {selected && editor.isEditable && (
          <>
            <span className="img-handle img-nw" onPointerDown={(e) => dragResize(e, false)} />
            <span className="img-handle img-ne" onPointerDown={(e) => dragResize(e, true)} />
            <span className="img-handle img-sw" onPointerDown={(e) => dragResize(e, false)} />
            <span className="img-handle img-se" onPointerDown={(e) => dragResize(e, true)} />
          </>
        )}
      </span>
    </NodeViewWrapper>
  );
}
const round = (n: number) => Math.round(n * 10000) / 10000;
