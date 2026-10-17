import type { Editor } from '@tiptap/react';
import type { MenuDef, MenuItem } from '../components/MenuBar.tsx';
import type { DocStyles } from './docxImport.ts';
import { SIZES } from './fonts.ts';

type StyleKey = 'title' | 'subtitle' | 'h1' | 'h2' | 'h3';
export const STYLE_NAMES: Record<StyleKey, string> = { title: 'Title', subtitle: 'Subtitle', h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3' };

/** what the editor can do for the menus; DocPane owns the state behind each */
export interface DocMenuCtx {
  editor: Editor; styles: DocStyles; mdView: boolean; tabsOpen: boolean; zoom: number; hasFile: boolean; recent: { path: string; name: string }[]; sizeNow: number;
  actions: {
    home(): void; newDoc(): void; newMd(): void; open(): void; openRecent(path: string): void; save(): void; saveAs(): void; reset(): void; preferences(): void; quit(): void;
    cut(): void; copy(): void; paste(): void; pastePlain(): void; selectAll(): void; find(replace: boolean): void;
    toggleMarkdown(): void; toggleTabs(): void; width(): void; zoomTo(z: number): void; fullscreen(): void;
    image(): void; link(): void; emoji(): void; table(): void; date(text: string): void;
    setStyle(v: string): void; updateStyle(): void; resetStyles(): void; saveStyleDefaults(): void; setPageColour(c: string | null): void; customPageColour(): void;
    cropImage(): void; imageSize(mode: 'reset' | 'original'): void;
    wordCount(): void; clearFormatting(): void; fontSize(delta: number): void; lineHeight(v: number | null): void;
  };
}

const DATES: [string, (d: Date) => string][] = [
  ['Long', (d) => d.toLocaleDateString(undefined, { dateStyle: 'long' })],
  ['With weekday', (d) => d.toLocaleDateString(undefined, { dateStyle: 'full' })],
  ['2026-10-17 (ISO)', (d) => d.toISOString().slice(0, 10)],
  ['Short', (d) => d.toLocaleDateString(undefined, { dateStyle: 'short' })],
  ['Time', (d) => d.toLocaleTimeString(undefined, { timeStyle: 'short' })],
  ['Date and time', (d) => d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })],
];
const sep: MenuItem = { sep: true };

/** The menu bar of the first TurboDocs (docs/development/LEGACY_REFERENCE.md): File, Edit, View, Insert, Format, Tools. */
export function docMenus(c: DocMenuCtx): MenuDef[] {
  const { editor: e, actions: a } = c;
  const run = (f: (ch: ReturnType<Editor['chain']>) => { run(): boolean }) => () => { f(e.chain().focus()).run(); };
  const inTable = e.isActive('table');
  const hasImage = e.isActive('image');
  const now = new Date();
  const style = e.isActive('heading', { level: 1 }) ? 'h1' : e.isActive('heading', { level: 2 }) ? 'h2' : e.isActive('heading', { level: 3 }) ? 'h3' : e.getAttributes('paragraph').pstyle === 'title' ? 'title' : e.getAttributes('paragraph').pstyle === 'subtitle' ? 'subtitle' : null;
  const colours: [string, string | null][] = [['Follow the theme', null], ['White', '#ffffff'], ['Warm paper', '#fbf3e4'], ['Light grey', '#eceff1'], ['Soft green', '#e6f4ea'], ['Soft blue', '#e3f0fc'], ['Dark grey', '#2b2d31'], ['Black', '#000000']];
  return [
    { label: 'File', items: [
      { label: 'Home', keys: 'Ctrl+Alt+H', run: a.home }, sep,
      { label: 'New document', keys: 'Ctrl+N', run: a.newDoc }, { label: 'New Markdown', run: a.newMd }, { label: 'Open…', keys: 'Ctrl+O', run: a.open },
      { label: 'Open recent', disabled: c.recent.length === 0, sub: c.recent.map((r) => ({ label: r.name, run: () => a.openRecent(r.path) })) }, sep,
      { label: 'Save', keys: 'Ctrl+S', run: a.save }, { label: 'Save as…', keys: 'Ctrl+Shift+S', run: a.saveAs },
      { label: 'Reset session edits', disabled: false, run: a.reset }, sep,
      { label: 'Preferences', run: a.preferences }, { label: 'Quit', keys: 'Ctrl+Q', run: a.quit },
    ] },
    { label: 'Edit', items: [
      { label: 'Undo', keys: 'Ctrl+Z', run: run((x) => x.undo()), disabled: !e.can().undo() }, { label: 'Redo', keys: 'Ctrl+Shift+Z', run: run((x) => x.redo()), disabled: !e.can().redo() }, sep,
      { label: 'Cut', keys: 'Ctrl+X', run: a.cut }, { label: 'Copy', keys: 'Ctrl+C', run: a.copy }, { label: 'Paste', keys: 'Ctrl+V', run: a.paste }, { label: 'Paste as plain text', keys: 'Ctrl+Shift+V', run: a.pastePlain }, { label: 'Select all', keys: 'Ctrl+A', run: a.selectAll }, sep,
      { label: 'Find…', keys: 'Ctrl+F', run: () => a.find(false) }, { label: 'Replace…', keys: 'Ctrl+H', run: () => a.find(true) },
    ] },
    { label: 'View', items: [
      { label: 'Markdown view', check: c.mdView, run: a.toggleMarkdown }, { label: 'Document tabs', check: c.tabsOpen, run: a.toggleTabs }, { label: 'Text width and margins…', keys: 'Ctrl+Alt+W', run: a.width }, sep,
      { label: 'Zoom in', keys: 'Ctrl+scroll', run: () => a.zoomTo(c.zoom + 10) }, { label: 'Zoom out', run: () => a.zoomTo(c.zoom - 10) }, { label: 'Reset zoom', run: () => a.zoomTo(100) }, sep,
      { label: 'Full screen', keys: 'F11', run: a.fullscreen },
    ] },
    { label: 'Insert', items: [
      { label: 'Image…', run: a.image }, { label: 'Table (3 × 3)', run: a.table }, { label: 'Link…', keys: 'Ctrl+K', run: a.link }, { label: 'Emoji…', run: a.emoji },
      { label: 'Date and time', sub: DATES.map(([l, f]) => ({ label: `${f(now)}`, run: () => a.date(f(now)), keys: l })) },
    ] },
    { label: 'Format', items: [
      { label: 'Text', sub: [
        { label: 'Bold', keys: 'Ctrl+B', check: e.isActive('bold'), run: run((x) => x.toggleBold()) }, { label: 'Italic', keys: 'Ctrl+I', check: e.isActive('italic'), run: run((x) => x.toggleItalic()) },
        { label: 'Underline', keys: 'Ctrl+U', check: e.isActive('underline'), run: run((x) => x.toggleUnderline()) }, { label: 'Strikethrough', keys: 'Ctrl+Shift+X', check: e.isActive('strike'), run: run((x) => x.toggleStrike()) }, sep,
        { label: 'Increase font size', keys: 'Ctrl+Shift+.', run: () => a.fontSize(1), disabled: c.sizeNow >= SIZES[SIZES.length - 1] }, { label: 'Decrease font size', keys: 'Ctrl+Shift+,', run: () => a.fontSize(-1), disabled: c.sizeNow <= SIZES[0] }, sep,
        { label: 'Clear formatting', keys: 'Ctrl+\\', run: a.clearFormatting },
      ] },
      { label: 'Paragraph styles', sub: [
        { label: 'Normal text', keys: 'Ctrl+Alt+0', check: style === null, run: () => a.setStyle('normal') },
        ...(['title', 'subtitle', 'h1', 'h2', 'h3'] as StyleKey[]).map((k, i): MenuItem => ({ label: STYLE_NAMES[k], keys: k.startsWith('h') ? `Ctrl+Alt+${i - 1}` : undefined, check: style === k, run: () => a.setStyle(k) })), sep,
        { label: `Update “${style ? STYLE_NAMES[style] : 'Normal text'}” to match selection`, run: a.updateStyle }, { label: 'Reset paragraph styles', run: a.resetStyles }, { label: 'Save these styles as my defaults', run: a.saveStyleDefaults },
      ] },
      { label: 'Align and indent', sub: [
        { label: 'Left', keys: 'Ctrl+Shift+L', check: e.isActive({ textAlign: 'left' }), run: run((x) => x.setTextAlign('left')) }, { label: 'Centre', keys: 'Ctrl+Shift+E', check: e.isActive({ textAlign: 'center' }), run: run((x) => x.setTextAlign('center')) },
        { label: 'Right', keys: 'Ctrl+Shift+R', check: e.isActive({ textAlign: 'right' }), run: run((x) => x.setTextAlign('right')) }, { label: 'Justify', keys: 'Ctrl+Shift+J', check: e.isActive({ textAlign: 'justify' }), run: run((x) => x.setTextAlign('justify')) }, sep,
        { label: 'Increase indent', keys: 'Ctrl+]', run: run((x) => x.sinkListItem('listItem')) }, { label: 'Decrease indent', keys: 'Ctrl+[', run: run((x) => x.liftListItem('listItem')) },
      ] },
      { label: 'Line and paragraph spacing', sub: ([[null, 'Default'], [1, 'Single'], [1.15, '1.15'], [1.5, '1.5'], [2, 'Double']] as const).map(([v, l]) => ({ label: l, run: () => a.lineHeight(v) })) },
      { label: 'Bulleted list', keys: 'Ctrl+Shift+8', check: e.isActive('bulletList'), run: run((x) => x.toggleBulletList()) }, { label: 'Numbered list', keys: 'Ctrl+Shift+7', check: e.isActive('orderedList'), run: run((x) => x.toggleOrderedList()) }, sep,
      { label: 'Page colour', sub: [...colours.map(([l, v]): MenuItem => ({ label: l, check: v === null ? !c.styles.pageColor : c.styles.pageColor === v, run: () => a.setPageColour(v) })), { label: 'Custom…', run: a.customPageColour }] },
      { label: 'Image', disabled: !hasImage, sub: [{ label: 'Crop', run: a.cropImage }, { label: 'Reset size', run: () => a.imageSize('reset') }, { label: 'Original size', run: () => a.imageSize('original') }] },
      { label: 'Table', disabled: !inTable, sub: [
        { label: 'Row above', run: run((x) => x.addRowBefore()) }, { label: 'Row below', run: run((x) => x.addRowAfter()) }, { label: 'Column left', run: run((x) => x.addColumnBefore()) }, { label: 'Column right', run: run((x) => x.addColumnAfter()) }, sep,
        { label: 'Merge cells', run: run((x) => x.mergeCells()), disabled: !e.can().mergeCells() }, { label: 'Split cell', run: run((x) => x.splitCell()), disabled: !e.can().splitCell() }, sep,
        { label: 'Cell colour: highlight colour', run: run((x) => x.setCellAttribute('backgroundColor', '#fff176')) }, { label: 'Cell colour: none', run: run((x) => x.setCellAttribute('backgroundColor', null)) }, sep,
        { label: 'Delete row', run: run((x) => x.deleteRow()) }, { label: 'Delete column', run: run((x) => x.deleteColumn()) }, { label: 'Delete table', run: run((x) => x.deleteTable()) },
      ] },
    ] },
    { label: 'Tools', items: [{ label: 'Word count', keys: 'Ctrl+Shift+C', run: a.wordCount }, { label: 'Preferences', run: a.preferences }] },
  ];
}
