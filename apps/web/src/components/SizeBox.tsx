import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ContextMenu } from './ContextMenu.tsx';

/** A number box with a drop-down of usual sizes in the app's own menu look (the font size boxes). `onCommit` gets the text typed or the size picked. */
export function SizeBox({ value, onCommit, sizes, disabled, label = 'Font size', className = '' }: { value: string | number; onCommit: (text: string) => void; sizes: readonly number[]; disabled?: boolean; label?: string; className?: string }) {
  const [text, setText] = useState<string | null>(null);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => setText(null), [value]);
  const commit = () => { if (text !== null && text !== String(value)) onCommit(text); setText(null); };
  return (
    <span ref={box} className={`inline-flex items-center ${className}`}>
      <input aria-label={label} className="input !w-11 !rounded-r-none !px-1 !py-1 text-center text-sm" inputMode="decimal" disabled={disabled} value={text ?? String(value)}
        onFocus={(e) => e.currentTarget.select()} onChange={(e) => setText(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); (e.currentTarget as HTMLInputElement).blur(); } else if (e.key === 'Escape') { setText(null); (e.currentTarget as HTMLInputElement).blur(); } }} />
      <button type="button" aria-label={`${label}: choose`} title={`${label}: choose`} disabled={disabled} className="input !w-6 !rounded-l-none !border-l-0 !px-0 !py-1 flex items-center justify-center"
        onMouseDown={(e) => e.preventDefault()} onClick={() => { const r = box.current?.getBoundingClientRect(); if (r) setAt({ x: r.left, y: r.bottom + 2 }); }}><ChevronDown size={12} /></button>
      {at && <ContextMenu at={at} minWidth={72} items={sizes.map((z) => ({ label: String(z), check: String(z) === String(value), run: () => onCommit(String(z)) }))} onClose={() => setAt(null)} />}
    </span>
  );
}
