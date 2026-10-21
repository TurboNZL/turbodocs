import { useState } from 'react';
import { Popover } from '../editor/Popover.tsx';
import { COLOURS } from '../editor/fonts.ts';

const HEX = /^#?([0-9a-f]{6})$/i;
/** A hex colour box (type or paste #rrggbb); applies when it is a whole colour. */
export function HexBox({ value, onPick, className = '' }: { value: string; onPick: (c: string) => void; className?: string }) {
  const [text, setText] = useState<string | null>(null);
  const done = () => { const m = HEX.exec((text ?? '').trim()); if (m) onPick(`#${m[1].toLowerCase()}`); setText(null); };
  return <input aria-label="Colour as #rrggbb" className={`input !w-24 !py-0.5 text-xs ${className}`} spellCheck={false} value={text ?? value} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setText(e.target.value)} onBlur={done} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); done(); } }} />;
}

/** A colour swatch that opens the app's palette (and a hex box) instead of the operating system's colour window. */
export function ColourField({ value, onChange, label }: { value: string; onChange: (c: string) => void; label: string }) {
  return (
    <Popover label={label} trigger={<span className="block h-4 w-7 rounded border border-line" style={{ background: value }} />}>
      {(close) => (
        <div className="w-44">
          <div className="grid grid-cols-6 gap-1">{COLOURS.map((c) => <button key={c} type="button" role="menuitem" aria-label={c} title={c} className="h-5 w-5 rounded border border-line" style={{ background: c }} onClick={() => { onChange(c); close(); }} />)}</div>
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">Custom<HexBox value={value} onPick={(c) => { onChange(c); close(); }} /></div>
        </div>
      )}
    </Popover>
  );
}
