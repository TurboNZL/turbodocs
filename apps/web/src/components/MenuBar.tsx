import { useEffect, useRef, useState } from 'react';

/** One entry of a menu. `check` draws a tick; `sub` opens a second level; `sep` is a divider. */
export type MenuItem = { sep: true } | { label: string; keys?: string; run?: () => void; disabled?: boolean; check?: boolean; sub?: MenuItem[] };
export interface MenuDef { label: string; items: MenuItem[] }

export function Items({ items, close }: { items: MenuItem[]; close: () => void }) {
  const [openSub, setOpenSub] = useState<number | null>(null);
  return (
    <>
      {items.map((it, i) => {
        if ('sep' in it) return <div key={i} className="my-1 border-t border-line" role="separator" />;
        return (
          <div key={it.label} className="relative" onMouseEnter={() => setOpenSub(it.sub ? i : null)}>
            <button type="button" role="menuitem" disabled={it.disabled} aria-haspopup={it.sub ? 'menu' : undefined} aria-checked={it.check}
              className="flex w-full items-center gap-6 whitespace-nowrap px-3 py-1 text-left text-sm hover:bg-hover disabled:opacity-40"
              onClick={() => { if (it.sub) { setOpenSub(i); return; } close(); it.run?.(); }}>
              <span className="w-3 text-xs">{it.check ? '✓' : ''}</span><span className="flex-1">{it.label}</span>
              <span className="text-xs text-muted">{it.sub ? '▸' : it.keys}</span>
            </button>
            {it.sub && openSub === i && <div role="menu" className="bt-menu tk-pop absolute left-full top-0 z-40 ml-0.5 min-w-[10rem] p-1.5"><Items items={it.sub} close={close} /></div>}
          </div>
        );
      })}
    </>
  );
}

/**
 * A menu bar (File, Edit, ...) like the first TurboDocs'. Opens on click, then follows the pointer from one title to the next; Escape or a click outside
 * closes it. Menus are plain data, so each app (Docs, Sheets, Slides) builds its own.
 */
export function MenuBar({ menus, label = 'Menu' }: { menus: MenuDef[]; label?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open === null) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div ref={box} role="menubar" aria-label={label} className="bt-top flex items-center gap-px px-2 py-0.5 text-sm">
      {menus.map((m, i) => (
        <div key={m.label} className="relative" onMouseEnter={() => { if (open !== null) setOpen(i); }}>
          <button type="button" className={`btn btn-ghost !px-2.5 !py-0.5 ${open === i ? 'tb-on' : ''}`} aria-haspopup="menu" aria-expanded={open === i} onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(open === i ? null : i)}>{m.label}</button>
          {open === i && <div role="menu" aria-label={m.label} className="bt-menu tk-pop absolute left-0 top-full z-40 mt-0.5 min-w-[14rem] p-1.5" onMouseDown={(e) => e.preventDefault()}><Items items={m.items} close={() => setOpen(null)} /></div>}
        </div>
      ))}
    </div>
  );
}
