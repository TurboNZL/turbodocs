import { Section } from './Section.tsx';
import { FontBox } from './FontBox.tsx';
import { resetDocPrefs, setDocPrefs, useDocPrefs, type DocPrefs } from '../lib/docPrefs.ts';
import { FACTORY_STYLES, type StyleDef } from '../editor/docxImport.ts';
import { STYLE_NAMES } from '../editor/docMenus.ts';

const Check = ({ id, label, hint }: { id: keyof DocPrefs; label: string; hint?: string }) => {
  const p = useDocPrefs();
  return <label className="flex items-start gap-2 py-1 text-sm"><input type="checkbox" className="mt-1" checked={p[id] as boolean} onChange={(e) => setDocPrefs({ [id]: e.target.checked })} /><span>{label}{hint && <span className="block text-xs text-muted">{hint}</span>}</span></label>;
};
const Num = ({ id, label, min, max, step = 1, suffix }: { id: keyof DocPrefs; label: string; min: number; max: number; step?: number; suffix?: string }) => {
  const p = useDocPrefs();
  return <label className="flex items-center gap-3 py-1 text-sm"><span className="w-44">{label}</span><input type="number" className="input !w-28 !py-1" min={min} max={max} step={step} value={p[id] as number}
    onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) setDocPrefs({ [id]: Math.min(max, Math.max(min, v)) }); }} />{suffix && <span className="text-muted">{suffix}</span>}</label>;
};
const KEYS = ['title', 'subtitle', 'h1', 'h2', 'h3'] as const;

/** Settings > Documents: what the first TurboDocs' Preferences window held (general, document defaults, paragraph styles, editing). Document defaults apply to NEW documents. */
export function DocsSettings() {
  const p = useDocPrefs();
  const style = (k: (typeof KEYS)[number]): StyleDef => ({ ...FACTORY_STYLES[k], ...(p.styles[k] ?? {}) });
  const setStyle = (k: (typeof KEYS)[number], patch: Partial<StyleDef>) => setDocPrefs({ styles: { ...p.styles, [k]: { ...style(k), ...patch } } });
  return (
    <div className="space-y-5">
      <Section title="General">
        <Check id="animations" label="Animations" hint="Pages, menus and windows slide and fade in. Your system's reduce-motion setting turns them off as well." />
        <Num id="backupSec" label="Back up after idle for" min={0.5} max={120} step={0.5} suffix="seconds" />
        <p className="text-xs text-muted">While you type, a copy of the unsaved document is kept in the app's autosave folder and offered back if the app closes unexpectedly. Your file is only changed when you save.</p>
        <label className="flex items-center gap-3 py-1 text-sm"><span className="w-44">Default folder</span><input className="input !py-1" placeholder="The system's choice" value={p.defaultDir} onChange={(e) => setDocPrefs({ defaultDir: e.target.value })} aria-label="Default folder" /></label>
        <Check id="showWordCount" label="Show the word count in the status bar" />
        <Check id="showZoom" label="Show the zoom control in the status bar" />
        <Check id="reopenLast" label="Reopen the last document on startup" />
        <Check id="confirmReset" label="Ask before resetting session edits" />
      </Section>
      <Section title="Document defaults">
        <p className="text-sm text-muted">For new documents. A document you open keeps its own styles (Format › Paragraph styles).</p>
        <div className="flex items-center gap-3 py-1 text-sm"><span className="w-44">Font</span><FontBox value={p.docFont || FACTORY_STYLES.font} onPick={(f) => setDocPrefs({ docFont: f })} label="Default font" />{p.docFont && <button className="btn btn-ghost text-xs" onClick={() => setDocPrefs({ docFont: '' })}>Use {FACTORY_STYLES.font}</button>}</div>
        <Num id="docSize" label="Font size" min={6} max={72} step={0.5} suffix="pt" />
        <Num id="line" label="Line spacing" min={1} max={3} step={0.01} />
        <Num id="after" label="Space after a paragraph" min={0} max={60} suffix="px" />
        <Num id="width" label="Text width" min={360} max={1600} suffix="px" />
        <Num id="marginL" label="Left margin" min={0} max={400} suffix="px" />
        <Num id="marginR" label="Right margin" min={0} max={400} suffix="px" />
        <p className="text-xs text-muted">Width and margins are also set while editing (Ctrl+Alt+W); the values there are remembered for the computer, these are where a computer starts.</p>
      </Section>
      <Section title="Paragraph styles">
        <p className="text-sm text-muted">How each style looks in new documents.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted"><th className="py-1 font-medium">Style</th><th className="font-medium">Size (pt)</th><th className="font-medium">Bold</th><th className="font-medium">Italic</th><th className="font-medium">Space before</th><th className="font-medium">Space after</th></tr></thead>
            <tbody>
              {KEYS.map((k) => { const s = style(k); return (
                <tr key={k}>
                  <td className="py-1 pr-3">{STYLE_NAMES[k]}</td>
                  <td><input type="number" aria-label={`${STYLE_NAMES[k]} size`} className="input !w-20 !py-1" min={6} max={96} step={0.5} value={s.size ?? 11} onChange={(e) => setStyle(k, { size: Number(e.target.value) || 11 })} /></td>
                  <td><input type="checkbox" aria-label={`${STYLE_NAMES[k]} bold`} checked={!!s.bold} onChange={(e) => setStyle(k, { bold: e.target.checked })} /></td>
                  <td><input type="checkbox" aria-label={`${STYLE_NAMES[k]} italic`} checked={!!s.italic} onChange={(e) => setStyle(k, { italic: e.target.checked })} /></td>
                  <td><input type="number" aria-label={`${STYLE_NAMES[k]} space before`} className="input !w-20 !py-1" min={0} max={80} value={s.before ?? 0} onChange={(e) => setStyle(k, { before: Number(e.target.value) || 0 })} /></td>
                  <td><input type="number" aria-label={`${STYLE_NAMES[k]} space after`} className="input !w-20 !py-1" min={0} max={80} value={s.after ?? 0} onChange={(e) => setStyle(k, { after: Number(e.target.value) || 0 })} /></td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
        <button className="btn text-sm" onClick={() => setDocPrefs({ styles: {} })}>Reset styles to the factory defaults</button>
      </Section>
      <Section title="Editing">
        <p className="text-xs text-muted">These apply the next time a document is opened.</p>
        <Check id="mdShortcuts" label="Markdown shortcuts" hint="“- ” starts a bullet list, “1. ” a numbered one, “# ” a heading." />
        <Check id="dashes" label="Turn -- into an em dash" />
        <Check id="smartQuotes" label="Curly “smart” quotes" />
        <Check id="emojiCodes" label="Emoji shortcodes" hint="Type :smile: or :fire: and it becomes the emoji." />
        <Check id="highlightLine" label="Highlight the current line" />
        <Check id="pastePlain" label="Paste as plain text by default" hint="Ctrl+Shift+V then pastes with formatting." />
      </Section>
      <button className="btn text-sm" onClick={() => { if (window.confirm('Put every Documents setting back to its default?')) resetDocPrefs(); }}>Reset all of these to the defaults</button>
    </div>
  );
}
