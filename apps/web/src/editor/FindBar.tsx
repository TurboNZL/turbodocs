import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { NO_SEARCH, type FindOptions } from './find.ts';
import { cn } from '../lib/cn.ts';

/**
 * Find and replace bar (Ctrl+F / Ctrl+H, Esc closes), above the text. It owns what you typed; the editor owns the matches and tells the bar
 * how many there are, so the same bar serves the Word editor and the plain-text editor.
 */
export function FindBar({ replaceMode, count, index, onSearch, onStep, onReplace, onReplaceAll, onClose, focusKey }: {
  replaceMode: boolean; count: number; index: number; focusKey: number;
  onSearch: (o: FindOptions) => void; onStep: (dir: 1 | -1) => void; onReplace: (r: string) => void; onReplaceAll: (r: string) => void; onClose: () => void;
}) {
  const [opts, setOpts] = useState<FindOptions>(NO_SEARCH);
  const [repl, setRepl] = useState('');
  const [showReplace, setShowReplace] = useState(replaceMode);
  const input = useRef<HTMLInputElement>(null);
  const bad = opts.regex && opts.query !== '' && (() => { try { new RegExp(opts.query); return false; } catch { return true; } })();
  useEffect(() => { setShowReplace((v) => v || replaceMode); input.current?.focus(); input.current?.select(); }, [focusKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const change = (n: Partial<FindOptions>) => { const next = { ...opts, ...n }; setOpts(next); onSearch(next); };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'Enter') { e.preventDefault(); onStep(e.shiftKey ? -1 : 1); }
  };
  const toggle = (on: boolean) => cn('btn btn-ghost !px-2 !py-0.5 text-xs font-mono', on && 'tb-on');
  return (
    <div role="search" aria-label="Find and replace" className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-1.5 text-sm" onKeyDown={key}>
      <input ref={input} aria-label="Find" className={cn('input !w-56 !py-1', bad && 'border-bad')} placeholder="Find" value={opts.query} onChange={(e) => change({ query: e.target.value })} />
      <span className="w-20 text-xs tabular-nums text-muted" role="status" aria-live="polite">{bad ? 'Invalid regex' : opts.query ? (count ? `${index + 1} of ${count}` : 'No results') : ''}</span>
      <button type="button" className="btn btn-ghost !px-1.5" aria-label="Previous match (Shift+Enter)" title="Previous (Shift+Enter)" disabled={!count} onClick={() => onStep(-1)}><ChevronUp size={15} /></button>
      <button type="button" className="btn btn-ghost !px-1.5" aria-label="Next match (Enter)" title="Next (Enter)" disabled={!count} onClick={() => onStep(1)}><ChevronDown size={15} /></button>
      <button type="button" className={toggle(opts.caseSensitive)} aria-pressed={opts.caseSensitive} title="Match case" onClick={() => change({ caseSensitive: !opts.caseSensitive })}>Aa</button>
      <button type="button" className={toggle(opts.regex)} aria-pressed={opts.regex} title="Regular expression" onClick={() => change({ regex: !opts.regex })}>.*</button>
      {showReplace
        ? <>
            <input aria-label="Replace with" className="input !w-48 !py-1" placeholder="Replace with" value={repl} onChange={(e) => setRepl(e.target.value)} />
            <button type="button" className="btn text-xs" disabled={!count} onClick={() => onReplace(repl)}>Replace</button>
            <button type="button" className="btn text-xs" disabled={!count} onClick={() => onReplaceAll(repl)}>Replace all</button>
          </>
        : <button type="button" className="btn btn-ghost text-xs" onClick={() => setShowReplace(true)}>Replace…</button>}
      <span className="flex-1" />
      <button type="button" className="btn btn-ghost !px-1.5" aria-label="Close (Esc)" title="Close (Esc)" onClick={onClose}><X size={15} /></button>
    </div>
  );
}
