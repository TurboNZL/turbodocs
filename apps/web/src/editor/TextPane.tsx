import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FindBar } from './FindBar.tsx';
import { findInString, NO_SEARCH, replaceAllInString, replacementFor, type FindOptions } from './find.ts';
import { DocHeader } from './DocHeader.tsx';
import { StatusBar, words } from './StatusBar.tsx';
import { useSaver } from './useSaver.ts';
import { renderMarkdown } from '../lib/markdown.ts';
import { setDirty } from '../lib/dirty.ts';
import { usePref } from '../lib/pref.ts';

/**
 * Markdown and plain text: edited as the text it is, so a save writes exactly what is on screen (line endings kept) and never reformats
 * the file. Markdown has a rendered preview beside it.
 */
export function TextPane({ initial, kind, path, name }: { initial: string; kind: 'md' | 'txt'; path: string | null; name: string }) {
  const crlf = useMemo(() => /\r\n/.test(initial), [initial]);
  const [text, setText] = useState(initial.replace(/\r\n?/g, '\n'));
  const [dirty, setDirtyState] = useState(false);
  const [zoom, setZoom] = usePref('editor.zoom', 100);
  const [preview, setPreview] = usePref('editor.mdPreview', 'on');
  const area = useRef<HTMLTextAreaElement>(null);
  const [find, setFind] = useState<{ open: boolean; replace: boolean; n: number }>({ open: false, replace: false, n: 0 });
  const [fo, setFo] = useState<FindOptions>(NO_SEARCH);
  const [cur, setCur] = useState(0);
  const matches = useMemo(() => (find.open ? findInString(text, fo) : []), [find.open, text, fo]);
  const index = matches.length ? Math.min(cur, matches.length - 1) : 0;
  const select = useCallback((i: number) => { const m = matches[i]; const ta = area.current; if (!m || !ta) return; setCur(i); ta.focus(); ta.setSelectionRange(m.from, m.to); document.querySelector<HTMLInputElement>('[role=search] input')?.focus(); }, [matches]);
  const saver = useSaver({ path, name, warnings: [], getBytes: async () => (crlf ? text.replace(/\n/g, '\r\n') : text) });
  const doSave = async (as = false) => { if (await saver.save(as)) setDirtyState(false); };
  useEffect(() => () => setDirty(false), []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void doSave(e.shiftKey); }
      else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && ['f', 'h'].includes(e.key.toLowerCase())) { e.preventDefault(); setFind((f) => ({ open: true, replace: e.key.toLowerCase() === 'h' || f.replace, n: f.n + 1 })); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  const html = useMemo(() => (kind === 'md' && preview === 'on' ? renderMarkdown(text) : ''), [kind, preview, text]);
  const n = words(text);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <DocHeader name={saver.name} path={saver.path} dirty={dirty} busy={saver.busy} onSave={() => void doSave()} onSaveAs={() => void doSave(true)} />
      {find.open && <FindBar replaceMode={find.replace} focusKey={find.n} count={matches.length} index={index}
        onClose={() => { setFind((f) => ({ ...f, open: false })); area.current?.focus(); }} onSearch={(o) => { setFo(o); setCur(0); }}
        onStep={(d) => select((index + d + matches.length) % matches.length)}
        onReplace={(r) => { const m = matches[index]; if (m) { setText(text.slice(0, m.from) + replacementFor(text.slice(m.from, m.to), fo, r) + text.slice(m.to)); setDirty(true); setDirtyState(true); } }}
        onReplaceAll={(r) => { const out = replaceAllInString(text, fo, r); setText(out.text); setDirty(true); setDirtyState(true); }} />}
      {kind === 'md' && (
        <div className="flex items-center gap-2 px-3 pb-2 text-sm">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preview === 'on'} onChange={(e) => setPreview(e.target.checked ? 'on' : 'off')} />Preview</label>
          <span className="text-muted">Markdown is edited as plain text; the file is saved exactly as you see it on the left.</span>
        </div>
      )}
      <div className={`grid min-h-0 flex-1 gap-4 px-3 pb-2 ${html ? 'md:grid-cols-2' : ''}`} style={{ zoom: zoom / 100 }}>
        <textarea ref={area} aria-label={kind === 'md' ? 'Markdown source' : 'Text'} className="input h-full min-h-[12rem] w-full resize-none font-mono text-sm leading-relaxed" spellCheck value={text}
          onChange={(e) => { setText(e.target.value); setDirty(true); setDirtyState(true); }} />
        {html && <article className="guide card min-h-0 overflow-y-auto p-5" dangerouslySetInnerHTML={{ __html: html }} />}
      </div>
      <StatusBar editor={null} zoom={zoom} setZoom={setZoom} message={`${saver.message}${saver.message ? '  ·  ' : ''}${n} ${n === 1 ? 'word' : 'words'}`} />
    </div>
  );
}
