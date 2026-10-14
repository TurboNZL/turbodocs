import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import { Minus, Plus } from 'lucide-react';

export const ZOOM_MIN = 25, ZOOM_MAX = 400;
export const words = (t: string) => t.split(/\s+/).filter(Boolean).length;

/** Word count (of the selection when there is one) and zoom, like the first TurboDocs' status bar. */
export function StatusBar({ editor, zoom, setZoom, message }: { editor: Editor | null; zoom: number; setZoom: (z: number) => void; message?: string }) {
  const n = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return { count: 0, selection: false };
      const { from, to, empty } = e.state.selection;
      return { count: words(empty ? e.state.doc.textBetween(0, e.state.doc.content.size, ' ', ' ') : e.state.doc.textBetween(from, to, ' ', ' ')), selection: !empty };
    },
  });
  const clamp = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z)));
  return (
    <div className="bt-footer flex items-center gap-4 px-3 py-1 text-xs text-muted">
      <span className="flex-1 truncate" role="status">{message}</span>
      {editor && n && <span>{n.count} {n.count === 1 ? 'word' : 'words'}{n.selection ? ' selected' : ''}</span>}
      <span className="flex items-center gap-1.5">
        <button type="button" className="btn btn-ghost !px-1.5 !py-0.5" aria-label="Zoom out" onClick={() => setZoom(clamp(zoom - 10))}><Minus size={12} /></button>
        <input type="range" aria-label="Zoom" min={ZOOM_MIN} max={ZOOM_MAX} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="bt-range bt-hit w-28" style={{ '--p': `${((zoom - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN)) * 100}%` } as React.CSSProperties} />
        <button type="button" className="btn btn-ghost !px-1.5 !py-0.5" aria-label="Zoom in" onClick={() => setZoom(clamp(zoom + 10))}><Plus size={12} /></button>
        <button type="button" className="w-10 text-right tabular-nums" title="Reset zoom to 100%" onClick={() => setZoom(100)}>{zoom}%</button>
      </span>
    </div>
  );
}
