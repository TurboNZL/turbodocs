import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { desktop } from '../lib/settings.ts';
import { importDocx, type DocStyles, type Json } from '../editor/docxImport.ts';
import { newDocStyles } from '../editor/newDoc.ts';
import { DocPane } from '../editor/DocPane.tsx';
import { TextPane } from '../editor/TextPane.tsx';
import { SheetPane } from '../sheets/SheetPane.tsx';
import { SlidesPane } from '../slides/SlidesPane.tsx';
import { importXlsx } from '../sheets/xlsx.ts';
import { importCsv } from '../sheets/csv.ts';
import { newWorkbook, type Workbook } from '../sheets/model.ts';
import { importPptx } from '../slides/pptx.ts';
import type { Deck } from '../slides/model.ts';
import { newDeck } from '../slides/layouts.ts';

type Kind = 'docx' | 'md' | 'txt' | 'xlsx' | 'csv' | 'pptx';
const EXT: Record<string, Kind> = { '.docx': 'docx', '.md': 'md', '.markdown': 'md', '.txt': 'txt', '.xlsx': 'xlsx', '.csv': 'csv', '.pptx': 'pptx' };
const kindOf = (path: string): Kind | null => EXT[/\.[^./\\]+$/.exec(path)?.[0].toLowerCase() ?? ''] ?? null;
const BLANK: Json = { type: 'doc', content: [{ type: 'paragraph' }] };
const UNTITLED: Record<Kind, string> = { docx: 'Untitled.docx', md: 'Untitled.md', txt: 'Untitled.txt', xlsx: 'Untitled.xlsx', csv: 'Untitled.csv', pptx: 'Untitled.pptx' };
type Loaded =
  | { kind: 'docx'; json: Json; warnings: string[]; styles: DocStyles }
  | { kind: 'md' | 'txt'; text: string }
  | { kind: 'xlsx' | 'csv'; book: Workbook; warnings: string[]; csv?: { crlf: boolean; bom: boolean } }
  | { kind: 'pptx'; deck: Deck; warnings: string[] };

/** Loads the file (or starts a new one) and hands it to the app for its type: Docs, Sheets or Slides. */
export function EditPage() {
  const [params] = useSearchParams();
  const path = params.get('path');
  const fresh = params.get('new') as Kind | null;
  const nonce = params.get('n') ?? '';
  const [reload, setReload] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setLoaded(null); setError(null);
    const set = (l: Loaded) => { if (alive) setLoaded(l); };
    (async () => {
      if (fresh && !path) {
        if (fresh === 'docx') set({ kind: 'docx', json: BLANK, warnings: [], styles: newDocStyles() });
        else if (fresh === 'xlsx') set({ kind: 'xlsx', book: newWorkbook(), warnings: [] });
        else if (fresh === 'pptx') set({ kind: 'pptx', deck: newDeck(), warnings: [] });
        else if (fresh === 'md' || fresh === 'txt') set({ kind: fresh, text: '' });
        else throw new Error('Unknown kind of new file.');
        return;
      }
      const d = desktop();
      if (!d) throw new Error('Files open in the desktop app.');
      const kind = path ? kindOf(path) : null;
      if (!path || !kind) throw new Error('No installed app opens this type of file.');
      const bytes = await d.readFile(path);
      if (kind === 'docx') { const r = await importDocx(bytes); set({ kind, json: r.doc, warnings: r.warnings, styles: r.styles }); }
      else if (kind === 'xlsx') { const r = await importXlsx(bytes); set({ kind, book: r.book, warnings: r.warnings }); }
      else if (kind === 'csv') { const r = importCsv(bytes); set({ kind, book: r.book, warnings: [], csv: { crlf: r.crlf, bom: r.bom } }); }
      else if (kind === 'pptx') { const r = await importPptx(bytes); set({ kind, deck: r.deck, warnings: r.warnings }); }
      else set({ kind, text: new TextDecoder('utf-8').decode(bytes) });
    })().catch((e: Error) => { if (alive) setError(e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')); });
    return () => { alive = false; };
  }, [path, fresh, nonce, reload]);

  const name = path ? (path.split(/[\\/]/).pop() ?? path) : UNTITLED[fresh ?? 'docx'];
  if (error) return <div className="mx-auto max-w-3xl p-6"><div className="rounded-theme bg-bad/15 p-3 text-sm text-bad">{error}</div></div>;
  if (!loaded) return <div className="p-6 text-sm text-muted">Loading…</div>;
  // key: another file is a new editor, never the old one with new content
  const key = `${path ?? `new-${fresh}-${nonce}`}-${reload}`;
  const onReset = () => setReload((n) => n + 1);
  switch (loaded.kind) {
    case 'docx': return <DocPane key={key} initial={loaded.json} path={path} name={name} warnings={loaded.warnings} styles={loaded.styles} onReset={onReset} />;
    case 'xlsx': case 'csv': return <SheetPane key={key} initial={loaded.book} kind={loaded.kind} path={path} name={name} warnings={loaded.warnings} csv={loaded.kind === 'csv' ? loaded.csv : undefined} onReset={onReset} />;
    case 'pptx': return <SlidesPane key={key} initial={loaded.deck} path={path} name={name} warnings={loaded.warnings} onReset={onReset} />;
    default: return <TextPane key={key} initial={loaded.text} kind={loaded.kind} path={path} name={name} />;
  }
}
