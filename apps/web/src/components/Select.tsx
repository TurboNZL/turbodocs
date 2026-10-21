import { useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { ContextMenu } from './ContextMenu.tsx';
import type { MenuItem } from './MenuBar.tsx';

/**
 * A drop-down in the app's own look: a button that opens the theme's menu (`.bt-menu`) under it, instead of the operating system's list. Arrow keys, Enter and Esc work.
 * With `display` the button always shows that (a "Borders" or "Shape" button that does something when you pick); otherwise it shows the chosen option.
 */
export function Select<T extends string | number>({ value, options, onChange, label, className = '', display, title, disabled }: {
  value?: T | ''; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string; className?: string; display?: ReactNode; title?: string; disabled?: boolean;
}) {
  const [at, setAt] = useState<{ x: number; y: number; w: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const open = () => { const r = btn.current?.getBoundingClientRect(); if (r) setAt({ x: r.left, y: r.bottom + 2, w: r.width }); };
  const items: MenuItem[] = options.map((o) => ({ label: o.label, check: o.value === value, run: () => onChange(o.value) }));
  const shown = display ?? options.find((o) => o.value === value)?.label ?? '';
  return (
    <>
      <button ref={btn} type="button" aria-label={label} title={title ?? label} aria-haspopup="listbox" aria-expanded={!!at} disabled={disabled}
        className={`input flex items-center justify-between gap-1 text-left text-sm ${className}`}
        onMouseDown={(e) => e.preventDefault()} onClick={open}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); } }}>
        <span className="min-w-0 flex-1 truncate">{shown}</span><ChevronDown size={13} className="shrink-0 text-muted" />
      </button>
      {at && <ContextMenu at={at} items={items} minWidth={at.w} onClose={() => { setAt(null); btn.current?.focus(); }} />}
    </>
  );
}
