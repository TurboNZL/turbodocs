import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FONT_CHOICES, fontStack } from '../editor/fonts.ts';
import { askForFonts, deviceHasFont, useDetectedFonts } from '../lib/fontList.ts';
import { desktop } from '../lib/settings.ts';

const PAGE = 40;

/**
 * The font box: the documents' usual fonts first, then every font installed on this computer (engine module `system-fonts`; a search box and "Show more"
 * keep a thousand families cheap), each name drawn in its own font. Typing a name that is not listed is fine: a document can be opened on a computer that
 * has it. A font the current document names but this device lacks is flagged, so the stand-in is not a surprise.
 */
export function FontBox({ value, onPick, label = 'Font', className = '' }: { value: string; onPick: (family: string) => void; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(PAGE);
  const box = useRef<HTMLDivElement>(null);
  const detected = useDetectedFonts();
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  const needle = q.trim().toLowerCase();
  const builtIn = FONT_CHOICES.filter((f) => f.toLowerCase().includes(needle));
  const installed = useMemo(() => (detected?.fonts ?? []).map((f) => f.family).filter((f) => !FONT_CHOICES.includes(f) && f.toLowerCase().includes(needle)), [detected, needle]);
  const missing = !!value && !FONT_CHOICES.includes(value) && !deviceHasFont(value, detected);
  const choose = (f: string) => { onPick(f); setOpen(false); setQ(''); };
  const row = (f: string) => <button key={f} type="button" role="menuitem" className="block w-full truncate px-3 py-1 text-left text-sm hover:bg-hover" style={{ fontFamily: fontStack(f) }} aria-checked={f === value} onClick={() => choose(f)}>{f === value ? '✓ ' : ''}{f}</button>;
  return (
    <div ref={box} className={`relative inline-flex ${className}`}>
      <button type="button" className="input flex !w-36 items-center justify-between gap-1 !py-1 text-left text-sm" aria-label={label} title={missing ? `${value} is not installed on this computer; a stand-in is drawn` : label} aria-haspopup="menu" aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()} onClick={() => { setOpen((o) => !o); setShown(PAGE); }}>
        <span className="truncate" style={{ fontFamily: fontStack(value) }}>{missing ? '⚠ ' : ''}{value}</span><ChevronDown size={12} className="shrink-0" />
      </button>
      {open && (
        <div role="menu" className="bt-menu tk-pop absolute left-0 top-full z-40 mt-1 w-64 p-1.5" onMouseDown={(e) => { if ((e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault(); }}>
          <input autoFocus className="input mb-1 !py-1 text-sm" placeholder="Search fonts, or type a name and press Enter" aria-label="Search fonts" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) { e.preventDefault(); choose(builtIn[0] ?? installed.find((f) => f.toLowerCase() === needle) ?? q.trim()); } }} />
          <div className="max-h-72 overflow-y-auto">
            {builtIn.map(row)}
            {installed.length > 0 && <div className="px-3 pb-0.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Installed on this computer</div>}
            {installed.slice(0, shown).map(row)}
            {installed.length > shown && <button type="button" className="block w-full px-3 py-1 text-left text-sm text-accent" onClick={() => setShown(shown + PAGE * 2)}>Show more ({installed.length - shown})</button>}
            {!builtIn.length && !installed.length && <div className="px-3 py-2 text-sm text-muted">No font by that name. Enter uses it anyway.</div>}
          </div>
          {!desktop() && detected?.source !== 'local-fonts' && <button type="button" className="btn mt-1 w-full text-xs" onClick={() => void askForFonts()}>Find installed fonts</button>}
          {detected?.note && <p className="px-2 pt-1 text-[11px] text-muted">{detected.note}</p>}
        </div>
      )}
    </div>
  );
}
