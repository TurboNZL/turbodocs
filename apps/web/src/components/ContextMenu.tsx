import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Items, type MenuItem } from './MenuBar.tsx';

/** A right-click menu at the pointer, in the same look as the menu bar's menus (the items are the same plain data). Esc, a click elsewhere or scrolling closes it. */
export function ContextMenu({ at, items, onClose }: { at: { x: number; y: number }; items: MenuItem[]; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(at);
  useLayoutEffect(() => {
    const b = box.current?.getBoundingClientRect(); if (!b) return;
    setPos({ x: Math.max(4, Math.min(at.x, window.innerWidth - b.width - 4)), y: Math.max(4, Math.min(at.y, window.innerHeight - b.height - 4)) });
  }, [at]);
  useEffect(() => {
    const away = (e: Event) => { if (!box.current?.contains(e.target as Node)) onClose(); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('mousedown', away, true); document.addEventListener('keydown', esc, true); window.addEventListener('resize', onClose); window.addEventListener('wheel', onClose, { passive: true });
    return () => { document.removeEventListener('mousedown', away, true); document.removeEventListener('keydown', esc, true); window.removeEventListener('resize', onClose); window.removeEventListener('wheel', onClose); };
  }, [onClose]);
  return createPortal(
    <div ref={box} role="menu" aria-label="Context menu" className="bt-menu tk-pop fixed z-[70] min-w-[14rem] p-1.5" style={{ left: pos.x, top: pos.y }} onMouseDown={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()}>
      <Items items={items} close={onClose} />
    </div>,
    document.body,
  );
}
