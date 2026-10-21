import { useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowUpDown, Baseline, Bold, ChevronDown, Highlighter, ImageIcon, IndentDecrease, IndentIncrease, Italic, Link as LinkIcon,
  List, ListOrdered, MoveHorizontal, Redo2, Smile, Table2, Underline, Undo2,
} from 'lucide-react';
import { Popover } from './Popover.tsx';
import { COLOURS, SIZES } from './fonts.ts';
import { FontBox } from '../components/FontBox.tsx';
import { Select } from '../components/Select.tsx';
import { OverflowBar } from '../components/OverflowBar.tsx';
import { HexBox } from '../components/ColourField.tsx';
import { SizeBox } from '../components/SizeBox.tsx';
import { cn } from '../lib/cn.ts';

/**
 * The formatting toolbar, in the order of the first TurboDocs (docs/development/LEGACY_REFERENCE.md): undo, redo | paragraph style | font |
 * size | B I U | text colour | highlight | align | line spacing | lists and indent | link, image, table | (space) | width.
 * Only hook classes and tokens: the look is the theme's.
 */
const STYLES = [['normal', 'Normal text'], ['title', 'Title'], ['subtitle', 'Subtitle'], ['h1', 'Heading 1'], ['h2', 'Heading 2'], ['h3', 'Heading 3']] as const;
const LINE = [[null, 'Default'], [1, 'Single'], [1.15, '1.15'], [1.5, '1.5'], [2, 'Double']] as const;

export const Sep = () => <span className="mx-0.5 h-5 w-px self-center bg-line" aria-hidden />;

export function Btn({ label, onClick, active, disabled, children }: { label: string; onClick: () => void; active?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return <button type="button" className={cn('btn btn-ghost tb-btn', active && 'tb-on')} aria-label={label} title={label} aria-pressed={active} disabled={disabled}
    onMouseDown={(e) => e.preventDefault()} onClick={onClick}>{children}</button>;
}

const CUSTOM_KEY = 'turbodocs.customColours';
const customColours = (): string[] => { try { const v = JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? '[]') as unknown; return Array.isArray(v) ? v.filter((c): c is string => typeof c === 'string').slice(0, 9) : []; } catch { return []; } };
const rememberCustom = (c: string) => { try { localStorage.setItem(CUSTOM_KEY, JSON.stringify([c, ...customColours().filter((x) => x !== c)].slice(0, 9))); } catch { /* storage blocked */ } };

/** Docs-style split button: the icon applies the last colour used, the arrow opens the palette. */
export function SplitColour({ label, icon, last, onApply, onPick }: { label: string; icon: React.ReactNode; last: string; onApply: (c: string) => void; onPick: (c: string) => void }) {
  return (
    <span className="inline-flex items-center">
      <button type="button" className="btn btn-ghost tb-btn" aria-label={`${label} (${last})`} title={label} onMouseDown={(e) => e.preventDefault()} onClick={() => onApply(last)}>
        <span className="flex flex-col items-center leading-none">{icon}<span className="mt-0.5 h-[3px] w-4 rounded-sm" style={{ background: last }} /></span>
      </button>
      <Popover label={`${label}: choose`} trigger={<ChevronDown size={12} />} className="!px-0.5">
        {(close) => (
          <div className="w-44">
            <div className="grid grid-cols-6 gap-1">
              {COLOURS.map((c) => <button key={c} type="button" role="menuitem" aria-label={c} title={c} className="h-5 w-5 rounded border border-line" style={{ background: c }} onClick={() => { onPick(c); close(); }} />)}
            </div>
            {customColours().length > 0 && <div className="mt-2 grid grid-cols-6 gap-1" aria-label="Your colours">{customColours().map((c) => <button key={c} type="button" role="menuitem" aria-label={c} title={c} className="h-5 w-5 rounded border border-line" style={{ background: c }} onClick={() => { onPick(c); close(); }} />)}</div>}
            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">Custom<HexBox value={last} onPick={(c) => { rememberCustom(c); onPick(c); close(); }} /></div>
          </div>
        )}
      </Popover>
    </span>
  );
}

export function Toolbar({ editor, width, setWidth, marginL, marginR, setMargins, base, widthKey, linkKey, onEmoji }: { editor: Editor; width: number; setWidth: (w: number) => void; marginL: number; marginR: number; setMargins: (l: number, r: number) => void; base: { font: string; size: number }; widthKey: number; linkKey: number; onEmoji: () => void }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const ts = e.getAttributes('textStyle');
      const style = e.isActive('heading', { level: 1 }) ? 'h1' : e.isActive('heading', { level: 2 }) ? 'h2' : e.isActive('heading', { level: 3 }) ? 'h3' : e.getAttributes('paragraph').pstyle === 'title' ? 'title' : e.getAttributes('paragraph').pstyle === 'subtitle' ? 'subtitle' : 'normal';
      return {
        canUndo: e.can().undo(), canRedo: e.can().redo(), style, font: (ts.fontFamily as string | undefined) ?? base.font, size: String((ts.fontSize as string | undefined)?.replace('pt', '') ?? base.size),
        bold: e.isActive('bold'), italic: e.isActive('italic'), underline: e.isActive('underline'), strike: e.isActive('strike'), link: e.isActive('link'), linkHref: (e.getAttributes('link').href as string | undefined) ?? '',
        left: e.isActive({ textAlign: 'left' }), center: e.isActive({ textAlign: 'center' }), right: e.isActive({ textAlign: 'right' }), justify: e.isActive({ textAlign: 'justify' }),
        bullets: e.isActive('bulletList'), numbers: e.isActive('orderedList'), inTable: e.isActive('table'),
        lineHeight: (e.getAttributes('paragraph').lineHeight ?? e.getAttributes('heading').lineHeight ?? null) as number | null,
      };
    },
  });
  const [textColour, setTextColour] = useState('#e06c75');
  const [hlColour, setHlColour] = useState('#fff176');
  const [sizeText, setSizeText] = useState<string | null>(null);
  const [linkText, setLinkText] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const run = () => editor.chain().focus();

  const setStyle = (v: string) => {
    if (v === 'h1' || v === 'h2' || v === 'h3') run().setHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run();
    else run().setParagraph().updateAttributes('paragraph', { pstyle: v === 'normal' ? null : v }).run();
  };
  const applySize = (text: string) => {
    const n = Number(text.replace(',', '.'));
    if (n >= 1 && n <= 400) run().setFontSize(`${n}pt`).run();
    setSizeText(null);
  };
  const setLineHeight = (v: number | null) => run().updateAttributes('paragraph', { lineHeight: v }).updateAttributes('heading', { lineHeight: v }).run();
  const insertImage = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      const img = new window.Image();
      img.onload = () => { const w = Math.min(img.naturalWidth || 400, 600); run().setImage({ src, width: w, height: Math.round(w * ((img.naturalHeight || 300) / (img.naturalWidth || 400))) } as never).run(); };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };
  const setLink = (href: string, close: () => void) => {
    const url = href.trim();
    if (!url) { run().unsetLink().run(); close(); return; }
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
    if (!/^(https?:|mailto:|tel:)/i.test(withScheme)) { close(); return; }
    if (editor.state.selection.empty && !s.link) run().insertContent({ type: 'text', text: withScheme, marks: [{ type: 'link', attrs: { href: withScheme } }] }).run();
    else run().extendMarkRange('link').setLink({ href: withScheme }).run();
    close();
  };

  return (
    <>
    <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/gif,image/bmp" hidden onChange={(e) => { insertImage(e.target.files?.[0]); e.target.value = ''; }} />
    <OverflowBar label="Formatting" groups={[
        <>
      <Btn label="Undo (Ctrl+Z)" onClick={() => run().undo().run()} disabled={!s.canUndo}><Undo2 size={16} /></Btn>
      <Btn label="Redo (Ctrl+Shift+Z)" onClick={() => run().redo().run()} disabled={!s.canRedo}><Redo2 size={16} /></Btn>
        </>,
        <>
      <Select label="Paragraph style" className="!w-32 !py-1" value={s.style} options={STYLES.map(([v, l]) => ({ value: v as string, label: l }))} onChange={(v) => setStyle(v)} />
      <FontBox value={s.font} onPick={(f) => run().setFontFamily(f).run()} />
      <SizeBox value={s.size} sizes={SIZES} onCommit={(t) => applySize(t)} />
        </>,
        <>
      <Btn label="Bold (Ctrl+B)" active={s.bold} onClick={() => run().toggleBold().run()}><Bold size={16} /></Btn>
      <Btn label="Italic (Ctrl+I)" active={s.italic} onClick={() => run().toggleItalic().run()}><Italic size={16} /></Btn>
      <Btn label="Underline (Ctrl+U)" active={s.underline} onClick={() => run().toggleUnderline().run()}><Underline size={16} /></Btn>
      <SplitColour label="Text colour" icon={<Baseline size={15} />} last={textColour} onApply={(c) => run().setColor(c).run()} onPick={(c) => { setTextColour(c); run().setColor(c).run(); }} />
      <SplitColour label="Highlight colour" icon={<Highlighter size={15} />} last={hlColour} onApply={(c) => run().setHighlight({ color: c }).run()} onPick={(c) => { setHlColour(c); run().setHighlight({ color: c }).run(); }} />
        </>,
        <>
      <Btn label="Align left (Ctrl+Shift+L)" active={s.left} onClick={() => run().setTextAlign('left').run()}><AlignLeft size={16} /></Btn>
      <Btn label="Centre (Ctrl+Shift+E)" active={s.center} onClick={() => run().setTextAlign('center').run()}><AlignCenter size={16} /></Btn>
      <Btn label="Align right (Ctrl+Shift+R)" active={s.right} onClick={() => run().setTextAlign('right').run()}><AlignRight size={16} /></Btn>
      <Btn label="Justify (Ctrl+Shift+J)" active={s.justify} onClick={() => run().setTextAlign('justify').run()}><AlignJustify size={16} /></Btn>
      <Popover label="Line spacing" trigger={<ArrowUpDown size={16} />}>
        {(close) => LINE.map(([v, l]) => <button key={l} type="button" role="menuitem" className="block w-full px-3 py-1 text-left text-sm hover:bg-hover" aria-checked={s.lineHeight === v} onClick={() => { setLineHeight(v); close(); }}>{s.lineHeight === v ? '✓ ' : ''}{l}</button>)}
      </Popover>
        </>,
        <>
      <Btn label="Bulleted list (Ctrl+Shift+8)" active={s.bullets} onClick={() => run().toggleBulletList().run()}><List size={16} /></Btn>
      <Btn label="Numbered list (Ctrl+Shift+7)" active={s.numbers} onClick={() => run().toggleOrderedList().run()}><ListOrdered size={16} /></Btn>
      <Btn label="Decrease indent" onClick={() => run().liftListItem('listItem').run()}><IndentDecrease size={16} /></Btn>
      <Btn label="Increase indent" onClick={() => run().sinkListItem('listItem').run()}><IndentIncrease size={16} /></Btn>
        </>,
        <>
      <Popover label="Insert link (Ctrl+K)" openKey={linkKey} trigger={<LinkIcon size={16} />} className={s.link ? 'tb-on' : ''}>
        {(close) => (
          <form className="flex w-72 items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); setLink(linkText || s.linkHref, close); }}>
            <input autoFocus aria-label="Link address" className="input !py-1 text-sm" placeholder="https://…" defaultValue={s.linkHref} onChange={(e) => setLinkText(e.target.value)} />
            <button className="btn btn-accent !py-1 text-sm" type="submit">Apply</button>
            {s.link && <button className="btn !py-1 text-sm" type="button" onClick={() => setLink('', close)}>Remove</button>}
          </form>
        )}
      </Popover>
      <Btn label="Insert emoji" onClick={onEmoji}><Smile size={16} /></Btn>
      <Btn label="Insert image" onClick={() => fileInput.current?.click()}><ImageIcon size={16} /></Btn>

      <Popover label="Table" trigger={<Table2 size={16} />}>
        {(close) => {
          const item = (label: string, f: () => void, enabled = true) => <button key={label} type="button" role="menuitem" disabled={!enabled} className="block w-full px-3 py-1 text-left text-sm hover:bg-hover disabled:opacity-40" onClick={() => { f(); close(); }}>{label}</button>;
          return (
            <>
              {item('Insert 3 × 3 table', () => run().insertTable({ rows: 3, cols: 3, withHeaderRow: false }).run())}
              {s.inTable && <>
                <div className="my-1 border-t border-line" />
                {item('Row above', () => run().addRowBefore().run())}{item('Row below', () => run().addRowAfter().run())}
                {item('Column left', () => run().addColumnBefore().run())}{item('Column right', () => run().addColumnAfter().run())}
                <div className="my-1 border-t border-line" />
                {item('Merge cells', () => run().mergeCells().run(), editor.can().mergeCells())}{item('Split cell', () => run().splitCell().run(), editor.can().splitCell())}
                <div className="my-1 border-t border-line" />
                {item('Cell colour: highlight colour', () => run().setCellAttribute('backgroundColor', hlColour).run())}{item('Cell colour: none', () => run().setCellAttribute('backgroundColor', null).run())}
                <div className="my-1 border-t border-line" />
                {item('Delete row', () => run().deleteRow().run())}{item('Delete column', () => run().deleteColumn().run())}{item('Delete table', () => run().deleteTable().run())}
              </>}
            </>
          );
        }}
      </Popover>
        </>,
      ]} pinned={
      <Popover label="Text width and margins (Ctrl+Alt+W)" openKey={widthKey} trigger={<span className="flex items-center gap-1 text-sm"><MoveHorizontal size={16} />Width</span>}>
        {() => (
          <div className="w-64 space-y-3">
            {([['Text width', width, 480, 1200, 20, (v: number) => setWidth(v)], ['Left margin', marginL, 0, 300, 10, (v: number) => setMargins(v, marginR)], ['Right margin', marginR, 0, 300, 10, (v: number) => setMargins(marginL, v)]] as const).map(([l, v, lo, hi, st, set]) => (
              <label key={l} className="block text-xs text-muted">{l}: <span className="tabular-nums text-fg">{v}px</span>
                <input type="range" min={lo} max={hi} step={st} value={v} onChange={(e) => set(Number(e.target.value))} className="bt-range bt-hit mt-1 w-full" style={{ '--p': `${((v - lo) / (hi - lo)) * 100}%` } as React.CSSProperties} />
              </label>
            ))}
          </div>
        )}
      </Popover>
      } />
    </>
  );
}
