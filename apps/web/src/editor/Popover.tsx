import { useEffect, useRef, useState, type ReactNode } from 'react';

/** A button that opens a small panel under it (the themes' `.bt-menu` look). Closes on Escape and on a click anywhere else. */
export function Popover({ trigger, label, children, className = '', openKey, align = 'left' }: { trigger: ReactNode; label: string; children: (close: () => void) => ReactNode; className?: string; openKey?: number; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (openKey) setOpen(true); }, [openKey]); // a keyboard shortcut opens it
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { const t = e.target as HTMLElement; if (!box.current?.contains(t) && !t.closest?.('.bt-menu')) setOpen(false); }; // a menu opened from inside the panel belongs to it
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div ref={box} className="relative inline-flex">
      <button type="button" className={`btn btn-ghost tb-btn ${className}`} aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen((o) => !o)}>{trigger}</button>
      {open && <div role="menu" className={`bt-menu tk-pop absolute top-full z-30 mt-1 min-w-[10rem] p-1.5 ${align === 'right' ? 'right-0' : 'left-0'}`} onMouseDown={(e) => e.preventDefault()}>{children(() => setOpen(false))}</div>}
    </div>
  );
}
