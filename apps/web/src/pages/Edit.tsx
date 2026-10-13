import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { desktop } from '../lib/settings.ts';
import { importDocx, type Json } from '../editor/docxImport.ts';
import { DocPane } from '../editor/DocPane.tsx';
import { TextPane } from '../editor/TextPane.tsx';

type Kind = 'docx' | 'md' | 'txt';
const kindOf = (path: string): Kind | null => { const e = /\.[^./\\]+$/.exec(path)?.[0].toLowerCase(); return e === '.docx' ? 'docx' : e === '.md' || e === '.markdown' ? 'md' : e === '.txt' ? 'txt' : null; };
const BLANK: Json = { type: 'doc', content: [{ type: 'paragraph' }] };
type Loaded = { kind: 'docx'; json: Json; warnings: string[] } | { kind: 'md' | 'txt'; text: string };

/** Loads the file (or starts a new one) and hands it to the editor for its type. */
export function EditPage() {
  const [params] = useSearchParams();
  const path = params.get('path');
  const fresh = params.get('new') as Kind | null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setLoaded(null); setError(null);
    (async () => {
      if (fresh && !path) { setLoaded(fresh === 'docx' ? { kind: 'docx', json: BLANK, warnings: [] } : { kind: fresh, text: '' }); return; }
      const d = desktop();
      if (!d) throw new Error('Files open in the desktop app.');
      const kind = path ? kindOf(path) : null;
      if (!path || !kind) throw new Error('The Docs module does not open this type of file.');
      const bytes = await d.readFile(path);
      if (kind === 'docx') { const r = await importDocx(bytes); if (alive) setLoaded({ kind, json: r.doc, warnings: r.warnings }); }
      else if (alive) setLoaded({ kind, text: new TextDecoder('utf-8').decode(bytes) });
    })().catch((e: Error) => { if (alive) setError(e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')); });
    return () => { alive = false; };
  }, [path, fresh]);

  const name = path ? (path.split(/[\\/]/).pop() ?? path) : fresh === 'docx' ? 'Untitled.docx' : fresh === 'md' ? 'Untitled.md' : 'Untitled';
  if (error) return <div className="mx-auto max-w-3xl p-6"><div className="rounded-theme bg-bad/15 p-3 text-sm text-bad">{error}</div></div>;
  if (!loaded) return <div className="p-6 text-sm text-muted">Loading…</div>;
  // key: another file is a new editor, never the old one with new content
  const key = `${path ?? `new-${fresh}`}`;
  return loaded.kind === 'docx'
    ? <DocPane key={key} initial={loaded.json} path={path} name={name} warnings={loaded.warnings} />
    : <TextPane key={key} initial={loaded.text} kind={loaded.kind} path={path} name={name} />;
}
