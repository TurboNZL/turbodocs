import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Items, type MenuItem } from './MenuBar.tsx';

/** A right-click menu at the pointer, in the same look as the menu bar's menus (the items are the same plain data). Esc, a click elsewhere or scrolling closes it. */
export function ContextMenu({ at, items, onClose, minWidth }: { at: { x: number; y: number }; items: MenuItem[]; onClose: () => void; minWidth?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(at);
  useLayoutEffect(() => {
    const b = box.current?.getBoundingClientRect(); if (!b) return;
    setPos({ x: Math.max(4, Math.min(at.x, window.innerWidth - b.width - 4)), y: Math.max(4, Math.min(at.y, window.innerHeight - b.height - 4)) });
  }, [at]);
  const close = useRef(onClose); close.current = onClose; // listeners stay put for the menu's life (see Dialog)
  useEffect(() => {
    const onClose = () => close.current();
    const away = (e: Event) => { if (!box.current?.contains(e.target as Node)) onClose(); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    // keyboard: arrows move between the items (the checked one first), Enter picks
    const focusables = () => [...(box.current?.querySelectorAll<HTMLButtonElement>('button[role=menuitem]:not(:disabled)') ?? [])];
    const first = focusables().find((b) => b.getAttribute('aria-checked') === 'true') ?? focusables()[0];
    first?.focus({ preventScroll: false });
    const nav = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const list = focusables(); if (!list.length) return;
      e.preventDefault(); e.stopPropagation();
      const i = list.indexOf(document.activeElement as HTMLButtonElement);
      list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length].focus();
    };
    document.addEventListener('keydown', nav, true);
    document.addEventListener('mousedown', away, true); document.addEventListener('keydown', esc, true); window.addEventListener('resize', onClose); window.addEventListener('wheel', onClose, { passive: true });
    return () => { document.removeEventListener('keydown', nav, true); document.removeEventListener('mousedown', away, true); document.removeEventListener('keydown', esc, true); window.removeEventListener('resize', onClose); window.removeEventListener('wheel', onClose); };
  }, []);
  return createPortal(
    <div ref={box} role="menu" aria-label="Context menu" className="bt-menu tk-pop fixed z-[70] overflow-y-auto p-1.5" style={{ left: pos.x, top: pos.y, minWidth: minWidth ?? 224, maxHeight: 'min(70vh, 28rem)' }} onMouseDown={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()}>
      <Items items={items} close={onClose} />
    </div>,
    document.body,
  );
}
