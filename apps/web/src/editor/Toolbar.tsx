import { useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowUpDown, Baseline, Bold, ChevronDown, Highlighter, ImageIcon, IndentDecrease, IndentIncrease, Italic, Link as LinkIcon,
  List, ListOrdered, MoveHorizontal, Redo2, Table2, Underline, Undo2,
} from 'lucide-react';
import { Popover } from './Popover.tsx';
import { COLOURS, DEFAULT_FONT, FONT_CHOICES, SIZES } from './fonts.ts';
import { cn } from '../lib/cn.ts';

/**
 * The formatting toolbar, in the order of the first TurboDocs (docs/development/LEGACY_REFERENCE.md): undo, redo | paragraph style | font |
 * size | B I U | text colour | highlight | align | line spacing | lists and indent | link, image, table | (space) | width.
 * Only hook classes and tokens: the look is the theme's.
 */
const STYLES = [['normal', 'Normal text'], ['title', 'Title'], ['subtitle', 'Subtitle'], ['h1', 'Heading 1'], ['h2', 'Heading 2'], ['h3', 'Heading 3']] as const;
const LINE = [[null, 'Default'], [1, 'Single'], [1.15, '1.15'], [1.5, '1.5'], [2, 'Double']] as const;

const Sep = () => <span className="mx-0.5 h-5 w-px self-center bg-line" aria-hidden />;

function Btn({ label, onClick, active, disabled, children }: { label: string; onClick: () => void; active?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return <button type="button" className={cn('btn btn-ghost tb-btn', active && 'tb-on')} aria-label={label} title={label} aria-pressed={active} disabled={disabled}
    onMouseDown={(e) => e.preventDefault()} onClick={onClick}>{children}</button>;
}

/** Docs-style split button: the icon applies the last colour used, the arrow opens the palette. */
function SplitColour({ label, icon, last, onApply, onPick }: { label: string; icon: React.ReactNode; last: string; onApply: (c: string) => void; onPick: (c: string) => void }) {
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
            <label className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">Custom<input type="color" value={last} onChange={(e) => onPick(e.target.value)} className="h-6 w-10 cursor-pointer bg-transparent" /></label>
          </div>
        )}
      </Popover>
    </span>
  );
}

export function Toolbar({ editor, width, setWidth }: { editor: Editor; width: number; setWidth: (w: number) => void }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const ts = e.getAttributes('textStyle');
      const style = e.isActive('heading', { level: 1 }) ? 'h1' : e.isActive('heading', { level: 2 }) ? 'h2' : e.isActive('heading', { level: 3 }) ? 'h3' : e.getAttributes('paragraph').pstyle === 'title' ? 'title' : e.getAttributes('paragraph').pstyle === 'subtitle' ? 'subtitle' : 'normal';
      return {
        canUndo: e.can().undo(), canRedo: e.can().redo(), style, font: (ts.fontFamily as string | undefined) ?? DEFAULT_FONT, size: String((ts.fontSize as string | undefined)?.replace('pt', '') ?? '11'),
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
    <div role="toolbar" aria-label="Formatting" className="tb-bar bt-top flex flex-wrap items-center gap-px px-2 py-1">
      <Btn label="Undo (Ctrl+Z)" onClick={() => run().undo().run()} disabled={!s.canUndo}><Undo2 size={16} /></Btn>
      <Btn label="Redo (Ctrl+Shift+Z)" onClick={() => run().redo().run()} disabled={!s.canRedo}><Redo2 size={16} /></Btn>
      <Sep />
      <select aria-label="Paragraph style" className="input !w-28 !py-1 text-sm" value={s.style} onChange={(e) => setStyle(e.target.value)}>
        {STYLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <select aria-label="Font" className="input !w-32 !py-1 text-sm" value={s.font} onChange={(e) => run().setFontFamily(e.target.value).run()}>
        {!FONT_CHOICES.includes(s.font) && <option value={s.font}>{s.font}</option>}
        {FONT_CHOICES.map((f) => <option key={f} value={f}>{f}</option>)}
      </select>
      <input aria-label="Font size" list="font-sizes" className="input !w-14 !px-1 !py-1 text-center text-sm" inputMode="decimal" value={sizeText ?? s.size}
        onFocus={(e) => e.currentTarget.select()} onChange={(e) => setSizeText(e.target.value)} onBlur={() => sizeText !== null && applySize(sizeText)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applySize(sizeText ?? s.size); } }} />
      <datalist id="font-sizes">{SIZES.map((z) => <option key={z} value={z} />)}</datalist>
      <Sep />
      <Btn label="Bold (Ctrl+B)" active={s.bold} onClick={() => run().toggleBold().run()}><Bold size={16} /></Btn>
      <Btn label="Italic (Ctrl+I)" active={s.italic} onClick={() => run().toggleItalic().run()}><Italic size={16} /></Btn>
      <Btn label="Underline (Ctrl+U)" active={s.underline} onClick={() => run().toggleUnderline().run()}><Underline size={16} /></Btn>
      <SplitColour label="Text colour" icon={<Baseline size={15} />} last={textColour} onApply={(c) => run().setColor(c).run()} onPick={(c) => { setTextColour(c); run().setColor(c).run(); }} />
      <SplitColour label="Highlight colour" icon={<Highlighter size={15} />} last={hlColour} onApply={(c) => run().setHighlight({ color: c }).run()} onPick={(c) => { setHlColour(c); run().setHighlight({ color: c }).run(); }} />
      <Sep />
      <Btn label="Align left (Ctrl+Shift+L)" active={s.left} onClick={() => run().setTextAlign('left').run()}><AlignLeft size={16} /></Btn>
      <Btn label="Centre (Ctrl+Shift+E)" active={s.center} onClick={() => run().setTextAlign('center').run()}><AlignCenter size={16} /></Btn>
      <Btn label="Align right (Ctrl+Shift+R)" active={s.right} onClick={() => run().setTextAlign('right').run()}><AlignRight size={16} /></Btn>
      <Btn label="Justify (Ctrl+Shift+J)" active={s.justify} onClick={() => run().setTextAlign('justify').run()}><AlignJustify size={16} /></Btn>
      <Popover label="Line spacing" trigger={<ArrowUpDown size={16} />}>
        {(close) => LINE.map(([v, l]) => <button key={l} type="button" role="menuitem" className="block w-full px-3 py-1 text-left text-sm hover:bg-hover" aria-checked={s.lineHeight === v} onClick={() => { setLineHeight(v); close(); }}>{s.lineHeight === v ? '✓ ' : ''}{l}</button>)}
      </Popover>
      <Sep />
      <Btn label="Bulleted list (Ctrl+Shift+8)" active={s.bullets} onClick={() => run().toggleBulletList().run()}><List size={16} /></Btn>
      <Btn label="Numbered list (Ctrl+Shift+7)" active={s.numbers} onClick={() => run().toggleOrderedList().run()}><ListOrdered size={16} /></Btn>
      <Btn label="Decrease indent" onClick={() => run().liftListItem('listItem').run()}><IndentDecrease size={16} /></Btn>
      <Btn label="Increase indent" onClick={() => run().sinkListItem('listItem').run()}><IndentIncrease size={16} /></Btn>
      <Sep />
      <Popover label="Insert link (Ctrl+K)" trigger={<LinkIcon size={16} />} className={s.link ? 'tb-on' : ''}>
        {(close) => (
          <form className="flex w-72 items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); setLink(linkText || s.linkHref, close); }}>
            <input autoFocus aria-label="Link address" className="input !py-1 text-sm" placeholder="https://…" defaultValue={s.linkHref} onChange={(e) => setLinkText(e.target.value)} />
            <button className="btn btn-accent !py-1 text-sm" type="submit">Apply</button>
            {s.link && <button className="btn !py-1 text-sm" type="button" onClick={() => setLink('', close)}>Remove</button>}
          </form>
        )}
      </Popover>
      <Btn label="Insert image" onClick={() => fileInput.current?.click()}><ImageIcon size={16} /></Btn>
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/gif,image/bmp" hidden onChange={(e) => { insertImage(e.target.files?.[0]); e.target.value = ''; }} />
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
      <span className="flex-1" />
      <Popover label="Text width" trigger={<span className="flex items-center gap-1 text-sm"><MoveHorizontal size={16} />Width</span>}>
        {() => (
          <label className="block w-60 text-xs text-muted">Text width: <span className="tabular-nums text-fg">{width}px</span>
            <input type="range" min={480} max={1200} step={20} value={width} onChange={(e) => setWidth(Number(e.target.value))} className="bt-range bt-hit mt-1 w-full" style={{ '--p': `${((width - 480) / 720) * 100}%` } as React.CSSProperties} />
          </label>
        )}
      </Popover>
    </div>
  );
}
