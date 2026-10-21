import { usePref } from '../lib/pref.ts';
import { Section } from './Section.tsx';

const LAYOUTS = [
  { id: 'side', label: 'Side bar', hint: 'Home and Settings in a bar on the left.' },
  { id: 'rail', label: 'Icon bar', hint: 'The same, as a narrow bar of icons.' },
  { id: 'top', label: 'Top bar', hint: 'Home and Settings in a row along the top; the pages get the full width.' },
] as const;

/** A small picture of each layout (blocks standing for the bar and the page). */
function Mock({ id }: { id: (typeof LAYOUTS)[number]['id'] }) {
  const bar = 'rounded-sm bg-accent/50', page = 'flex-1 rounded-sm bg-raised';
  return (
    <div className={`flex h-14 w-24 gap-1 rounded border border-line bg-bg p-1 ${id === 'top' ? 'flex-col' : ''}`} aria-hidden>
      {id === 'side' && <div className={`${bar} w-6`} />}{id === 'rail' && <div className={`${bar} w-2.5`} />}{id === 'top' && <div className={`${bar} h-2.5`} />}
      <div className={page} />
    </div>
  );
}

/** Settings › Appearance: where Home and Settings are listed, and whether a document hides that bar. */
export function LayoutPicker() {
  const [layout, setLayout] = usePref('ui.layout', 'side');
  const [focus, setFocus] = usePref('ui.focusEditing', 'on');
  return (
    <Section title="Layout">
      <div role="radiogroup" aria-label="Layout" className="flex flex-wrap gap-3">
        {LAYOUTS.map((l) => (
          <button key={l.id} type="button" role="radio" aria-checked={layout === l.id} title={l.hint} onClick={() => setLayout(l.id)}
            className={`flex flex-col items-center gap-1.5 rounded-theme border p-2 text-sm ${layout === l.id ? 'border-accent ring-2 ring-accent' : 'border-line hover:bg-hover'}`}>
            <Mock id={l.id} />{l.label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={focus === 'on'} onChange={(e) => setFocus(e.target.checked ? 'on' : 'off')} />Hide the bar while a document is open (its header has the way back to Home)</label>
    </Section>
  );
}
