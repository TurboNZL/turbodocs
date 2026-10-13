import { desktop } from '../lib/settings.ts';
import { Section } from './Section.tsx';
import { AppUpdatesCard, GraphicsLine } from './AppSettings.tsx';

/** Settings > This app: updates, the window frame and graphics. Outside the desktop app there is nothing to set here. */
export function ThisApp() {
  const d = desktop();
  if (!d) return <Section title="This app"><p className="text-sm text-muted">You are viewing TurboDocs in a browser: install the desktop app for updates and window options.</p></Section>;
  return (
    <div className="space-y-5">
      <AppUpdatesCard />
      <Section title="Window">
        {d.setCustomFrame && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={d.customFrame} onChange={(e) => void d.setCustomFrame!(e.target.checked)} />
            Draw the window decorations from the theme (applies after a restart)
          </label>
        )}
        <GraphicsLine />
      </Section>
    </div>
  );
}
