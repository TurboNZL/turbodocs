import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, Save, SaveAll } from 'lucide-react';
import { confirmLeave } from '../lib/dirty.ts';
import { viewUrl } from '../lib/opened.ts';

/** Name of the document, with Save, Save as and (for Word files) the read-only rendering of the original. */
export function DocHeader({ name, path, dirty, busy, onSave, onSaveAs }: { name: string; path: string | null; dirty: boolean; busy: boolean; onSave: () => void; onSaveAs: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2">
      <Link to="/" className="btn btn-ghost inline-flex items-center gap-1" aria-label="Back to Home" onClick={(e) => { if (!confirmLeave()) e.preventDefault(); }}><ArrowLeft size={16} />Home</Link>
      <h1 className="min-w-0 flex-1 truncate text-base font-semibold" title={path ?? name}>{name}{dirty && <span className="ml-1 text-accent" title="Unsaved changes" aria-label="unsaved changes">●</span>}</h1>
      {path && /\.docx$/i.test(path) && <Link to={viewUrl(path)} className="btn btn-ghost inline-flex items-center gap-1 text-sm" onClick={(e) => { if (!confirmLeave()) e.preventDefault(); }} title="How the saved file looks, drawn like Word draws it"><Eye size={15} />Original view</Link>}
      <button type="button" className="btn inline-flex items-center gap-1.5 text-sm" disabled={busy} onClick={onSaveAs}><SaveAll size={15} />Save as…</button>
      <button type="button" className="btn btn-accent inline-flex items-center gap-1.5 text-sm" disabled={busy || (!dirty && !!path)} onClick={onSave}><Save size={15} />Save</button>
    </div>
  );
}

/** The left end of the editors' one header row: back to Home and the document's name. */
export function DocTitle({ name, path, dirty }: { name: string; path: string | null; dirty: boolean }) {
  return (
    <div className="flex min-w-0 max-w-[18rem] items-center gap-1 pr-2">
      <Link to="/" className="btn btn-ghost !px-1.5" aria-label="Back to Home" title="Back to Home" onClick={(e) => { if (!confirmLeave()) e.preventDefault(); }}><ArrowLeft size={16} /></Link>
      <h1 className="min-w-0 truncate text-sm font-semibold" title={path ?? name}>{name}{dirty && <span className="ml-1 text-accent" title="Unsaved changes" aria-label="unsaved changes">●</span>}</h1>
    </div>
  );
}
/** The right end of that row: the read-only view of a Word file, Save as and Save. */
export function DocActions({ path, dirty, busy, onSave, onSaveAs }: { path: string | null; dirty: boolean; busy: boolean; onSave: () => void; onSaveAs: () => void }) {
  return (
    <div className="flex items-center gap-1.5">
      {path && /\.docx$/i.test(path) && <Link to={viewUrl(path)} className="btn btn-ghost inline-flex items-center gap-1 text-sm" onClick={(e) => { if (!confirmLeave()) e.preventDefault(); }} title="How the saved file looks, drawn like Word"><Eye size={15} />View</Link>}
      <button type="button" className="btn inline-flex items-center gap-1.5 text-sm !py-0.5" disabled={busy} onClick={onSaveAs}><SaveAll size={15} />Save as…</button>
      <button type="button" className="btn btn-accent inline-flex items-center gap-1.5 text-sm !py-0.5" disabled={busy || (!dirty && !!path)} onClick={onSave}><Save size={15} />Save</button>
    </div>
  );
}
