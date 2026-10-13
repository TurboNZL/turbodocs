import { useEffect, useState } from 'react';
import { FileText, FolderOpen, Presentation, Table2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { desktop, type ModuleInfo, type OpenRequest } from '../lib/settings.ts';
import { Section } from '../components/Section.tsx';
import { addOpened, useOpened, viewUrl } from '../lib/opened.ts';

const ICONS: Record<string, typeof FileText> = { docs: FileText, sheets: Table2, slides: Presentation };

/** Open a file (the dialog here, or the system via the layout) and see the apps. Files go to the module for their type (pages/View.tsx). */
export function HomePage() {
  const d = desktop();
  const [mods, setMods] = useState<ModuleInfo[]>([]);
  const opened = useOpened();
  const navigate = useNavigate();
  useEffect(() => { void d?.modules().then(setMods); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const open = () => void d?.openDialog().then((rs) => { rs.forEach(addOpened); const first = rs.find((r: OpenRequest) => r.module && r.installed); if (first) navigate(viewUrl(first.path)); });
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <h1 className="text-2xl font-bold">TurboDocs</h1>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-accent inline-flex items-center gap-2" disabled={!d} onClick={open}><FolderOpen size={16} />Open a file</button>
        {!d && <span className="text-sm text-muted">Opening files works in the desktop app.</span>}
      </div>
      {opened.length > 0 && (
        <Section title="Opened this session">
          <ul className="space-y-2 text-sm">
            {opened.map((o, i) => (
              <li key={`${o.path}-${i}`} className="flex flex-wrap items-baseline gap-2">
                {o.module && o.installed ? <Link className="break-all text-accent underline" to={viewUrl(o.path)}>{o.path}</Link> : <code className="select-all break-all">{o.path}</code>}
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
