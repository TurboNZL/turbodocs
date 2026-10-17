import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** A window over the page, in the themes' dialog look (`.bt-window .bt-titlebar .bt-body .bt-footer`); pops in (motion module). Esc or a click outside closes it. */
export function Dialog({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', esc, true);
    return () => window.removeEventListener('keydown', esc, true);
  }, [onClose]);
  return createPortal(
    <div className="bt-backdrop tk-fade fixed inset-0 z-50 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`bt-window tk-pop flex max-h-[85vh] w-full flex-col overflow-hidden ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="bt-titlebar flex items-center justify-between px-3 py-2"><h2 className="text-sm">{title}</h2><button type="button" className="bt-close leading-none" aria-label="Close" onClick={onClose}>×</button></div>
        <div className="bt-body min-h-0 flex-1 overflow-auto p-4">{children}</div>
        {footer && <div className="bt-footer flex justify-end gap-2 p-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
