import { useEffect, useState } from 'react';
import { desktop, type ModuleInfo } from '../lib/settings.ts';
import { Section } from './Section.tsx';

/** Settings > Apps: the modules (Docs, Sheets, Slides) that can be installed into or removed from this app, and the file types each one opens. */
export function AppsTab() {
  const d = desktop();
  const [mods, setMods] = useState<ModuleInfo[] | null>(null);
  useEffect(() => { void d?.modules().then(setMods); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <Section title="Apps"><p className="text-sm text-muted">App modules are managed in the desktop app.</p></Section>;
  if (!mods) return null;
  return (
    <Section title="Apps">
      <p className="text-sm text-muted">Each app is a module you can add or remove. A module opens the file types listed next to it, from Open, from a file dropped on the window, or from your file manager ("Open with TurboDocs").</p>
      <ul className="divide-y divide-line">
        {mods.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{m.title}</div>
              <div className="text-sm text-muted">{m.description} <span className="font-mono text-xs">{m.extensions.join(' ')}</span></div>
            </div>
            {m.available
              ? <button className={m.installed ? 'btn' : 'btn btn-accent'} onClick={() => void d.setModule(m.id, !m.installed).then(setMods)}>{m.installed ? 'Remove' : 'Install'}</button>
              : <span className="chip text-xs text-muted">Not built yet</span>}
          </li>
        ))}
      </ul>
    </Section>
  );
}
