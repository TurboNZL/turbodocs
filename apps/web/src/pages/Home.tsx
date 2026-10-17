import { useEffect, useState } from 'react';
import { FilePlus, FileText, FolderOpen, Presentation, Table2 } from 'lucide-react';
import { newUrl } from '../lib/actions.ts';
import { Link, useNavigate } from 'react-router-dom';
import { desktop, type ModuleInfo, type OpenRequest, type RecentDoc } from '../lib/settings.ts';
import { shortFolder, timeAgo } from '../lib/timeAgo.ts';
import { Section } from '../components/Section.tsx';
import { useArrivals } from '../lib/arrivals.ts';
import { addOpened, editUrl, useOpened } from '../lib/opened.ts';

const ICONS: Record<string, typeof FileText> = { docs: FileText, sheets: Table2, slides: Presentation };

/** Open a file (the dialog here, or the system via the layout) and see the apps. Files go to the module for their type (pages/View.tsx). */
export function HomePage() {
  const d = desktop();
  const [mods, setMods] = useState<ModuleInfo[]>([]);
  const opened = useOpened().filter((o) => !(o.module && o.installed)); // files that open straight in their module need no notice here
  const [recent, setRecent] = useState<RecentDoc[]>([]);
  const navigate = useNavigate();
  const arrived = useArrivals(recent.map((r) => r.path));
  useEffect(() => { void d?.modules().then(setMods); void d?.recent().then(setRecent); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const openRecent = (path: string) => void d?.openRecent(path).then((r) => { addOpened(r); navigate(editUrl(r.path)); }).catch(() => void d?.recent().then(setRecent));
  const open = () => void d?.openDialog().then((rs) => { rs.forEach(addOpened); const first = rs.find((r: OpenRequest) => r.module && r.installed); if (first) navigate(editUrl(first.path)); });
  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      <div><h1 className="text-2xl font-bold">TurboDocs</h1><p className="text-sm text-muted">Pageless writing with full .docx compatibility</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <Link className="btn btn-accent inline-flex items-center gap-2" to={newUrl('docx')}><FilePlus size={16} />New document</Link>
        <Link className="btn inline-flex items-center gap-2" to={newUrl('md')}><FilePlus size={16} />New Markdown</Link>
        {mods.find((m) => m.id === 'sheets')?.installed && <Link className="btn inline-flex items-center gap-2" to={newUrl('xlsx')}><Table2 size={16} />New spreadsheet</Link>}
        {mods.find((m) => m.id === 'slides')?.installed && <Link className="btn inline-flex items-center gap-2" to={newUrl('pptx')}><Presentation size={16} />New presentation</Link>}
        <button className="btn inline-flex items-center gap-2" disabled={!d} onClick={open}><FolderOpen size={16} />Open a file</button>
        {!d && <span className="text-sm text-muted">Opening and saving files works in the desktop app.</span>}
      </div>
      {d && (
        <section aria-label="Recent files" className="space-y-2">
          <div className="flex items-center gap-3">
            <h2 className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted">Recent files</h2>
            {recent.length > 0 && <button type="button" className="btn btn-ghost text-sm" onClick={() => void d.clearRecent().then(() => setRecent([]))}>Clear list</button>}
          </div>
          {recent.length === 0
            ? <p className="text-sm text-muted">Files you open or save show up here. Tip: Ctrl+O to open, Ctrl+Alt+H to come back to this page.</p>
            : <ul className="grid gap-3 sm:grid-cols-2">
                {recent.map((r) => (
                  <li key={r.path} className={arrived.has(r.path) ? 'tk-arrive' : ''}>
                    <button type="button" className="card bt-tile block w-full p-3 text-left" onClick={() => openRecent(r.path)} title={r.path}>
                      <span className="flex items-baseline gap-2"><span className="min-w-0 flex-1 truncate font-semibold">{(r.path.split(/[\\/]/).pop() ?? r.path).replace(/\.[^.]+$/, '')}</span><span className="shrink-0 text-xs text-muted">{timeAgo(r.at)}</span></span>
                      <span className="block truncate text-xs text-muted">{shortFolder(r.path)}</span>
                      {r.snippet && <span className="mt-1 line-clamp-3 block text-xs text-muted">{r.snippet}</span>}
                    </button>
                  </li>
                ))}
              </ul>}
        </section>
      )}
      {opened.length > 0 && (
        <Section title="Needs a module">
          <ul className="space-y-2 text-sm">
            {opened.map((o, i) => (
              <li key={`${o.path}-${i}`} className="flex flex-wrap items-baseline gap-2">
                {o.module && o.installed ? <Link className="break-all text-accent underline" to={editUrl(o.path)}>{o.path}</Link> : <code className="select-all break-all">{o.path}</code>}
                {!(o.module && o.installed) && <span className="text-muted">{o.module ? `→ needs the ${o.module} module (Settings › Apps)` : '→ no module opens this type'}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="Apps">
        <ul className="grid gap-3 sm:grid-cols-3">
          {(mods.length ? mods : [{ id: 'docs', title: 'Docs', description: 'Word documents, Markdown and text.' }, { id: 'sheets', title: 'Sheets', description: 'Excel workbooks and CSV.' }, { id: 'slides', title: 'Slides', description: 'PowerPoint presentations.' }] as Partial<ModuleInfo>[]).map((m) => {
            const Icon = ICONS[m.id!] ?? FileText;
            return (
              <li key={m.id} className="card bt-tile flex flex-col gap-1 p-4">
                <Icon size={22} className="text-accent" />
                <div className="font-medium">{m.title}</div>
                <div className="text-sm text-muted">{m.description}</div>
                <div className="text-xs text-muted">{m.available ? (m.installed ? 'Installed' : 'Not installed') : 'Not built yet'}</div>
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-muted">Add or remove apps under <Link className="text-accent underline" to="/settings?tab=apps">Settings › Apps</Link>.</p>
      </Section>
    </div>
  );
}
