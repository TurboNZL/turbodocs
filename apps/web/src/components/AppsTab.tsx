import { useEffect, useState } from 'react';
import { desktop, type DefaultApps, type ModuleInfo } from '../lib/settings.ts';
import { Section } from './Section.tsx';

/** Settings > Apps: the modules (Docs, Sheets, Slides) that can be installed into or removed from this app, and the file types each one opens. */
export function AppsTab() {
  const d = desktop();
  const [mods, setMods] = useState<ModuleInfo[] | null>(null);
  const [defaults, setDefaults] = useState<DefaultApps | null>(null);
  const [defaultsError, setDefaultsError] = useState('');
  useEffect(() => { void d?.modules().then(setMods); void d?.defaultApps().then(setDefaults); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const makeDefault = (mimes: string[]) => void d?.setDefaultApps(mimes).then((r) => { setDefaults(r); setDefaultsError(mimes.some((m) => !r.rows.find((x) => x.mime === m)?.isDefault) ? 'The system did not accept the change. If TurboDocs was installed from an AppImage, install the .deb (or use your file manager\'s "Open with › Always").' : ''); }).catch((e: Error) => setDefaultsError(e.message));
  if (!d) return <Section title="Apps"><p className="text-sm text-muted">App modules are managed in the desktop app.</p></Section>;
  if (!mods) return null;
  return (
    <div className="space-y-5">
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
      {defaults && defaults.rows.length > 0 && (
        <Section title="Default applications">
          <p className="text-sm text-muted">"Open with" lists TurboDocs for these file types once it is installed. Being the <i>default</i> (what a double-click opens) is a separate choice of your system, and other programs may hold it.</p>
          {defaults.supported ? (
            <>
              <ul className="divide-y divide-line">
                {defaults.rows.map((r) => (
                  <li key={r.mime} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                    <span className="w-16 font-mono">{r.ext}</span><span className="min-w-0 flex-1 truncate text-muted" title={r.mime}>{r.mime}</span>
                    {r.isDefault ? <span className="chip text-xs">TurboDocs is the default</span> : <button className="btn text-xs" onClick={() => makeDefault([r.mime])}>Make default</button>}
                  </li>
                ))}
              </ul>
              {defaults.rows.some((r) => !r.isDefault) && <button className="btn btn-accent text-sm" onClick={() => makeDefault(defaults.rows.filter((r) => !r.isDefault).map((r) => r.mime))}>Make TurboDocs the default for all of these</button>}
              {defaultsError && <p role="alert" className="text-sm text-warn">{defaultsError}</p>}
            </>
          ) : <p className="text-sm">{defaults.reason}</p>}
        </Section>
      )}
    </div>
  );
}
