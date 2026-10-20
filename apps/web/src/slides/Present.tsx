import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SlideStage } from './SlideCanvas.tsx';
import type { Deck } from './model.ts';

/** Full-screen show: ←/→, Space, PageUp/Down, Home/End, a click to go on, Esc to leave. Each slide fades in (the app's one motion language). */
export function Present({ deck, start, onClose }: { deck: Deck; start: number; onClose: (at: number) => void }) {
  const [i, setI] = useState(start);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const root = useRef<HTMLDivElement>(null);
  const last = deck.slides.length - 1;
  const go = (n: number) => setI(Math.max(0, Math.min(last, n)));
  useEffect(() => {
    const el = root.current;
    void el?.requestFullscreen?.().catch(() => undefined);
    const onFs = () => { if (!document.fullscreenElement) onClose(iRef.current); };
    document.addEventListener('fullscreenchange', onFs);
    const resize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', resize);
    return () => { document.removeEventListener('fullscreenchange', onFs); window.removeEventListener('resize', resize); if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const iRef = useRef(i); iRef.current = i;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(i); }
      else if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'n'].includes(e.key)) { e.preventDefault(); if (i === last && e.key !== 'ArrowDown') onClose(i); else go(i + 1); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p'].includes(e.key)) { e.preventDefault(); go(i - 1); }
      else if (e.key === 'Home') go(0); else if (e.key === 'End') go(last);
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  });
  const scale = Math.min(size.w / deck.w, size.h / deck.h);
  return createPortal(
    <div ref={root} className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-black" role="dialog" aria-label="Presentation" onClick={(e) => { if (e.clientX < size.w * 0.2) go(i - 1); else if (i === last) onClose(i); else go(i + 1); }} style={{ cursor: 'none' }}>
      <div key={i} className={deck.slides[i].trans ? `tk-show-${deck.slides[i].trans}` : "tk-fade"}><SlideStage slide={deck.slides[i]} deck={deck} scale={scale} /></div>
      <span className="pointer-events-none absolute bottom-3 right-4 rounded bg-black/50 px-2 py-0.5 text-xs text-white/80" aria-live="polite">{i + 1} / {deck.slides.length}</span>
    </div>,
    document.body,
  );
}
