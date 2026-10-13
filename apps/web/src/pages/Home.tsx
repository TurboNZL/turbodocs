import { useEffect, useState } from 'react';
import { FileText, FolderOpen, Presentation, Table2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { desktop, type ModuleInfo, type OpenRequest } from '../lib/settings.ts';
import { Section } from '../components/Section.tsx';

const ICONS: Record<string, typeof FileText> = { docs: FileText, sheets: Table2, slides: Presentation };

/** What the shell does today: take a file from Open, a drop or the system, and hand it to the module for its type. The modules themselves are not built yet. */
export function HomePage() {
  const d = desktop();
  const [mods, setMods] = useState<ModuleInfo[]>([]);
  const [opened, setOpened] = useState<OpenRequest[]>([]);
  useEffect(() => {
    if (!d) return;
    void d.modules().then(setMods);
    void d.takePending().then((r) => setOpened((o) => [...r, ...o]));
    return d.onOpen((r) => setOpened((o) => [r, ...o]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const open = () => void d?.openDialog().then((r) => setOpened((o) => [...r, ...o]));
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <h1 className="text-2xl font-bold">TurboDocs</h1>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-accent inline-flex items-center gap-2" disabled={!d} onClick={open}><FolderOpen size={16} />Open a file</button>
        {!d && <span className="text-sm text-muted">Opening files works in the desktop app.</span>}
      </div>
      {opened.length > 0 && (
        <Section title="Opened">
          <ul className="space-y-2 text-sm">
            {opened.map((o, i) => (
              <li key={`${o.path}-${i}`} className="flex flex-wrap items-baseline gap-2">
                <code className="select-all break-all">{o.path}</code>
                <span className="text-muted">{o.module ? (o.installed ? `→ ${o.module} module is installed, but has no viewer yet` : `→ needs the ${o.module} module (Settings › Apps)`) : '→ no module opens this type'}</span>
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
