import { useEffect, useMemo, useState } from 'react';
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
  const saver = useSaver({ path, name, warnings: [], getBytes: async () => (crlf ? text.replace(/\n/g, '\r\n') : text) });
  const doSave = async (as = false) => { if (await saver.save(as)) setDirtyState(false); };
  useEffect(() => () => setDirty(false), []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void doSave(e.shiftKey); } };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  const html = useMemo(() => (kind === 'md' && preview === 'on' ? renderMarkdown(text) : ''), [kind, preview, text]);
  const n = words(text);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <DocHeader name={saver.name} path={saver.path} dirty={dirty} busy={saver.busy} onSave={() => void doSave()} onSaveAs={() => void doSave(true)} />
      {kind === 'md' && (
        <div className="flex items-center gap-2 px-3 pb-2 text-sm">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preview === 'on'} onChange={(e) => setPreview(e.target.checked ? 'on' : 'off')} />Preview</label>
          <span className="text-muted">Markdown is edited as plain text; the file is saved exactly as you see it on the left.</span>
        </div>
      )}
      <div className={`grid min-h-0 flex-1 gap-4 px-3 pb-2 ${html ? 'md:grid-cols-2' : ''}`} style={{ zoom: zoom / 100 }}>
        <textarea aria-label={kind === 'md' ? 'Markdown source' : 'Text'} className="input h-full min-h-[12rem] w-full resize-none font-mono text-sm leading-relaxed" spellCheck value={text}
          onChange={(e) => { setText(e.target.value); setDirty(true); setDirtyState(true); }} />
        {html && <article className="guide card min-h-0 overflow-y-auto p-5" dangerouslySetInnerHTML={{ __html: html }} />}
      </div>
      <StatusBar editor={null} zoom={zoom} setZoom={setZoom} message={`${saver.message}${saver.message ? '  ·  ' : ''}${n} ${n === 1 ? 'word' : 'words'}`} />
    </div>
  );
}
