import { useEffect, useRef, useState, type ReactNode } from 'react';

/** A button that opens a small panel under it (the themes' `.bt-menu` look). Closes on Escape and on a click anywhere else. */
export function Popover({ trigger, label, children, className = '' }: { trigger: ReactNode; label: string; children: (close: () => void) => ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div ref={box} className="relative inline-flex">
      <button type="button" className={`btn btn-ghost tb-btn ${className}`} aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen((o) => !o)}>{trigger}</button>
      {open && <div role="menu" className="bt-menu absolute left-0 top-full z-30 mt-1 min-w-[10rem] p-1.5" onMouseDown={(e) => e.preventDefault()}>{children(() => setOpen(false))}</div>}
    </div>
  );
}
