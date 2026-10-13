import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { CSSProperties } from 'react';
import { Check, Eye, Search, Wand2 } from 'lucide-react';
import { effectiveUi, resolveTheme, themeStyle } from 'turbothemes';
import { startAppearance } from '../lib/appearance.ts';
import { cn } from '../lib/cn.ts';
import { Section } from './Section.tsx';

/**
 * Settings > Appearance, the way the engine's docs (PICKER.md, section 2a) say to do it:
 *  - hovering or focusing an option only moves the MOCK PAGE on the right; the real page changes on click and never before;
 *  - the colour chips are a multi-column grid, not one per line.
 * Built on the headless picker controller; the look it keeps is the engine's own (persisted by `start({ persist: true })`).
 */

/** A small mock of the app drawn with the real hook classes, coloured by the given palette and shaped by the given UI style (not the page's). */
function PreviewApp({ theme, ui }: { theme: string; ui: string }) {
  const def = resolveTheme(theme);
  return (
    <div data-theme={def.id} data-ui={ui} data-mode={def.dark ? 'dark' : 'light'} style={themeStyle(theme) as CSSProperties}
      className="pointer-events-none select-none overflow-hidden rounded-theme border border-line bg-bg text-fg" role="img" aria-label="Preview of the highlighted colour theme and UI style">
      <div className="bt-top flex items-center gap-2 p-2.5">
        <span className="text-sm font-bold">TurboDocs</span>
        <div className="relative flex-1"><Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" /><div className="input !py-1 pl-8 text-xs text-muted">Search documents…</div></div>
        <span className="btn btn-accent !px-2.5 !py-1 text-xs">Open</span>
      </div>
      <div className="flex">
        <div className="bt-side hidden w-24 shrink-0 flex-col gap-0.5 p-1.5 text-[11px] sm:flex">
          {['Home', 'Report', 'Settings'].map((n, i) => <span key={n} className="bt-nav px-2 py-1 font-medium" aria-current={i === 1 ? 'page' : undefined}>{n}</span>)}
        </div>
        <div className="min-w-0 flex-1 space-y-2.5 p-3">
          <div className="flex gap-1.5"><span className="btn !px-2 !py-0.5 text-xs font-bold">B</span><span className="btn !px-2 !py-0.5 text-xs italic">I</span><span className="btn !px-2 !py-0.5 text-xs underline">U</span><span className="btn btn-ghost !px-2 !py-0.5 text-xs">• List</span></div>
          <div className="space-y-1">
            <div className="text-base font-bold leading-tight">Quarterly report</div>
            <div className="text-[11px] leading-snug text-muted">Normal text with <b className="text-fg">bold</b> and <span className="text-accent">linked</span> words, in the document font of this style.</div>
          </div>
          <div className="card overflow-hidden">
            {[['Revenue', '9.4'], ['Costs', '8.7'], ['Margin', '8.1']].map(([t, r], i) => (
              <div key={t} className={cn('bt-row flex items-center gap-2 px-2.5 py-1.5', i === 0 && 'bt-row-current')}>
                <div className="min-w-0 flex-1 truncate text-xs font-medium">{t}</div><span className="chip">Q3</span><span className="text-xs font-bold tabular-nums text-top">{r}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-1.5"><div className="input flex-1 !py-1 text-xs">Title</div><span className="btn !px-2.5 !py-1 text-xs">Cancel</span><span className="btn btn-accent !px-2.5 !py-1 text-xs">Save</span></div>
          <input type="range" className="bt-range h-1 w-full" style={{ '--p': '62%' } as CSSProperties} readOnly value={62} min={0} max={100} tabIndex={-1} aria-hidden />
          <div className="bt-window pointer-events-none">
            <div className="bt-titlebar flex items-center justify-between px-3 py-1.5"><h2 className="text-xs font-semibold">Save changes?</h2><span className="bt-close text-xs leading-none">×</span></div>
            <div className="bt-body flex items-center justify-between gap-2 p-2.5 text-[11px] text-muted"><span>Dialogs and menus follow the style too.</span><span className="bt-menu w-20 py-0.5 text-[11px]"><span className="block px-2 py-0.5">Save</span><span role="menuitem" className="block px-2 py-0.5" style={{ background: 'var(--menu-hi-bg)', color: 'var(--menu-hi-fg)' }}>Save as…</span></span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The engine's own element for the parts that do not preview on the real page. It is created here with setAttribute because React 19 sets
 * attributes of a custom element as PROPERTIES when the element has a member of that name, and the element has a private method called
 * `sections`: <turbo-themes-picker sections="..."> in JSX replaces the method with a string and the element throws.
 */
function StockPicker({ sections }: { sections: string }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = document.createElement('turbo-themes-picker');
    el.setAttribute('sections', sections);
    host.current?.replaceChildren(el);
    return () => el.remove();
  }, [sections]);
  return <div ref={host} />;
}

type Tone = 'all' | 'dark' | 'light';
const GROUP_NOTE: Record<string, string> = { device: 'Follows your device.', own: "The app's own looks.", inspired: 'Pair with the UI style of the same name.', platform: 'Copied from a desktop or OS; pair with the matching UI style.' };
/** Chips flow in as many columns as fit: never one per line. */
const CHIP_GRID = 'grid grid-cols-[repeat(auto-fill,minmax(8.25rem,1fr))] gap-1.5';
const STYLE_GRID = 'grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-1.5';

export function AppearancePicker() {
  const picker = useMemo(() => startAppearance().picker(), []);
  const state = useSyncExternalStore(picker.subscribe, picker.getState);
  const [tone, setTone] = useState<Tone>('all');
  const [hoverTheme, setHoverTheme] = useState<string | null>(null);
  const [hoverUi, setHoverUi] = useState<string | null>(null);
  const { theme, ui } = state.appearance;
  const groups = picker.themes(tone);
  const styles = picker.styles();
  const labelOf = (id: string) => picker.themes().flatMap((g) => g.items).find((t) => t.id === id)?.label ?? id;
  const styleLabel = (id: string) => styles.find((s) => s.id === id)?.label ?? id;
  const shownTheme = hoverTheme ?? theme;
  const shownUi = hoverUi ?? ui;
  const matching = picker.matchingTheme();
  const describing = styles.find((s) => s.id === shownUi);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="min-w-0 space-y-5">
        <Section title="Colour theme">
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-auto text-sm text-muted">Colours only. Any theme works with any UI style.</p>
            <div role="group" aria-label="Show" className="flex gap-1 text-xs">
              {(['all', 'dark', 'light'] as Tone[]).map((t) => <button key={t} type="button" aria-pressed={tone === t} onClick={() => setTone(t)} className={cn('rounded-full border px-2.5 py-0.5 capitalize', tone === t ? 'border-accent text-accent' : 'border-line text-muted hover:text-fg')}>{t}</button>)}
            </div>
          </div>
          {groups.filter((g) => g.items.length).map((g) => (
            <div key={g.id} className="space-y-1.5">
              <div className="flex items-baseline gap-2"><h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{g.label}</h3><span className="truncate text-[11px] text-muted">{GROUP_NOTE[g.id]}</span></div>
              <div role="radiogroup" aria-label={g.label} className={CHIP_GRID} onMouseLeave={() => setHoverTheme(null)}>
                {g.items.map((t) => {
                  const selected = theme === t.id;
                  return (
                    <button key={t.id} type="button" role="radio" aria-checked={selected} title={t.note ? `${t.label}: ${t.note}` : t.label}
                      onClick={() => picker.set({ theme: t.id })} onMouseEnter={() => setHoverTheme(t.id)} onFocus={() => setHoverTheme(t.id)} onBlur={() => setHoverTheme(null)}
                      className={cn('flex min-w-0 items-center gap-2 rounded-theme border bg-raised/40 px-1.5 py-1 text-left transition-colors hover:border-accent', selected ? 'border-accent ring-1 ring-accent' : 'border-line')}>
                      {t.colors && <span className="flex h-5 w-9 shrink-0 overflow-hidden rounded border border-line/60" aria-hidden>{[t.colors.bg, t.colors.surface, t.colors.accent, t.colors.text].map((c, i) => <span key={i} className="h-full flex-1" style={{ background: c }} />)}</span>}
                      <span className="min-w-0 flex-1 truncate text-xs font-medium">{t.label}</span>
                      {selected && <Check size={12} className="shrink-0 text-accent" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </Section>

        <Section title="UI style">
          <p className="text-sm text-muted">Shape, type, depth and motion: how buttons, menus, dialogs and the bars look and move. Colours stay as chosen above.</p>
          {matching && matching !== theme && (
            <button type="button" className="btn inline-flex items-center gap-1.5 text-xs" onClick={() => picker.useMatchingTheme()} onMouseEnter={() => setHoverTheme(matching)} onMouseLeave={() => setHoverTheme(null)}>
              <Wand2 size={14} />Use matching colours ({labelOf(matching)})</button>)}
          <div role="radiogroup" aria-label="UI style" className={STYLE_GRID} onMouseLeave={() => setHoverUi(null)}>
            {styles.map((s) => {
              const selected = ui === s.id;
              return (
                <button key={s.id} type="button" role="radio" aria-checked={selected} title={s.description} onClick={() => picker.set({ ui: s.id })}
                  onMouseEnter={() => setHoverUi(s.id)} onFocus={() => setHoverUi(s.id)} onBlur={() => setHoverUi(null)}
                  className={cn('rounded-theme border bg-raised/40 px-2.5 py-1.5 text-left transition-colors hover:border-accent', selected ? 'border-accent ring-1 ring-accent' : 'border-line')}>
                  <span className="flex items-center justify-between gap-2"><span className="min-w-0 truncate text-xs font-medium">{s.label}</span>{selected && <Check size={12} className="shrink-0 text-accent" />}</span>
                </button>
              );
            })}
          </div>
          <p className="min-h-[2.5rem] rounded-theme bg-raised/50 px-3 py-2 text-xs leading-snug text-muted" aria-live="polite">
            <span className="font-medium text-fg">{describing?.label}: </span>{describing?.description}{shownUi === 'auto' ? ` On this device that is ${picker.device().name}.` : ''}</p>
        </Section>

        {/* wallpaper and theme updates: the engine's own controls, without the pieces that preview on the real page */}
        <Section title="Wallpaper and theme updates"><StockPicker sections="wallpaper,updates" /></Section>
      </div>

      <div className="lg:sticky lg:top-4">
        <div className="rounded-theme border-2 border-dashed border-accent bg-accent/10 p-2">
          <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-2.5 py-0.5 font-bold uppercase tracking-wider text-accent-fg"><Eye size={12} />Preview</span>
            <span className="truncate font-medium">{labelOf(shownTheme)} + {styleLabel(shownUi)}</span>
          </div>
          <PreviewApp theme={shownTheme} ui={effectiveUi(shownUi)} />
          <p className="mt-1.5 text-center text-[11px] text-muted">Not your real page. Hover an option to try it, click to apply.</p>
        </div>
        <p className="mt-2 text-xs text-muted">Now: <span className="font-medium text-fg">{labelOf(theme)}</span> + <span className="font-medium text-fg">{styleLabel(ui)}</span></p>
      </div>
    </div>
  );
}
