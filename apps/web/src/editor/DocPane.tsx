import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { ListTree } from 'lucide-react';
import { FindBar } from './FindBar.tsx';
import { NO_SEARCH } from './find.ts';
import { searchKey } from './search.ts';
import { makeExtensions } from './extensions.ts';
import { exportDocx } from './docxExport.ts';
import { FACTORY_STYLES, importDocx, type DocStyles, type Json } from './docxImport.ts';
import { styleVars } from './docStyles.ts';
import { Toolbar } from './Toolbar.tsx';
import { StatusBar } from './StatusBar.tsx';
import { DocActions, DocTitle } from './DocHeader.tsx';
import { useSaver } from './useSaver.ts';
import { useAutosave } from './useAutosave.ts';
import { docMenus, STYLE_NAMES } from './docMenus.ts';
import { MenuBar } from '../components/MenuBar.tsx';
import { WordCountDialog } from './WordCountDialog.tsx';
import { EmojiDialog } from './EmojiDialog.tsx';
import { OutlinePanel } from './OutlinePanel.tsx';
import { toMarkdown } from './toMarkdown.ts';
import { SIZES } from './fonts.ts';
import { usePref } from '../lib/pref.ts';
import { setDirty } from '../lib/dirty.ts';
import { desktop } from '../lib/settings.ts';
import { docPrefs, rememberLastFile, setDocPrefs, useDocPrefs } from '../lib/docPrefs.ts';
import { goHome, goNew, openFileDialog } from '../lib/actions.ts';
import { addOpened, editUrl } from '../lib/opened.ts';
import { confirmLeave } from '../lib/dirty.ts';

const idle = () => `new:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const luminance = (hex: string) => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };

/**
 * The Word-document editor. Pageless like the first TurboDocs: the text sits on the theme's own background in a centred column (width, margins and zoom are
 * the person's), no sheet of paper. Menu bar, one toolbar, the canvas, the status bar; the ☰ button opens the document tabs and outline.
 */
export function DocPane({ initial, path, name, warnings, styles: initialStyles, onReset }: { initial: Json; path: string | null; name: string; warnings: string[]; styles: DocStyles; onReset: () => void }) {
  const prefs = useDocPrefs();
  const navigate = useNavigate();
  const [width, setWidth] = usePref('editor.width', prefs.width);
  const [marginL, setMarginL] = usePref('editor.marginL', prefs.marginL);
  const [marginR, setMarginR] = usePref('editor.marginR', prefs.marginR);
  const [zoom, setZoom] = usePref('editor.zoom', 100);
  const [styles, setStyles] = useState(initialStyles);
  const [dirty, setDirtyState] = useState(false);
  const [mdView, setMdView] = useState<string | null>(null);
  const [tabsOpen, setTabsOpen] = useState(false);
  const [dialog, setDialog] = useState<'count' | 'emoji' | null>(null);
  const [keys, setKeys] = useState({ width: 0, link: 0 });
  const [recent, setRecent] = useState<{ path: string; name: string }[]>([]);
  const colourInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const newKey = useRef(idle());
  const typing = useMemo(() => ({ dashes: prefs.dashes, smartQuotes: prefs.smartQuotes, emojiCodes: prefs.emojiCodes, highlightLine: prefs.highlightLine }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const stylesRef = useRef(styles); stylesRef.current = styles;
  const touchRef = useRef<() => void>(() => undefined);
  const editor = useEditor({
    extensions: makeExtensions(typing),
    content: initial,
    enableInputRules: prefs.mdShortcuts || prefs.dashes || prefs.smartQuotes || prefs.emojiCodes,
    editorProps: { attributes: { class: 'docs-editor', spellcheck: 'true', 'aria-label': 'Document' } },
    onUpdate: () => { setDirty(true); setDirtyState(true); touchRef.current(); },
  });
  const [find, setFind] = useState<{ open: boolean; replace: boolean; n: number }>({ open: false, replace: false, n: 0 });
  const hits = useEditorState({ editor, selector: ({ editor: e }) => { const st = e ? searchKey.getState(e.state) : undefined; return { count: st?.matches.length ?? 0, index: st?.current ?? 0 }; } });
  const menuState = useEditorState({ editor, selector: ({ editor: e }) => (e ? JSON.stringify([e.state.selection.from, e.state.selection.to, e.can().undo(), e.can().redo(), e.getAttributes('textStyle').fontSize, e.isActive('table'), e.isActive('image')]) : '') });
  void menuState;
  const closeFind = useCallback(() => { editor?.commands.setSearch(NO_SEARCH); setFind((f) => ({ ...f, open: false })); editor?.commands.focus(); }, [editor]);
  const getBytes = async () => (await exportDocx(editor!.getJSON() as Json, stylesRef.current)).bytes;
  const saver = useSaver({ path, name, warnings, getBytes });
  const autosave = useAutosave(saver.path ?? newKey.current, getBytes);
  touchRef.current = autosave.touch;
  const doSave = async (as = false) => { if (await saver.save(as)) { setDirtyState(false); autosave.clear(); } };

  useEffect(() => () => setDirty(false), []);
  useEffect(() => { rememberLastFile(saver.path); }, [saver.path]);
  useEffect(() => { void desktop()?.recent().then((r) => setRecent(r.slice(0, 10).map((x) => ({ path: x.path, name: x.path.split(/[\\/]/).pop() ?? x.path })))); }, []);

  // ---- helpers the menus and shortcuts share
  const sizeNow = (() => { const f = editor?.getAttributes('textStyle').fontSize as string | undefined; return f ? parseFloat(f) : styles.size; })();
  const toggleTabs = () => setTabsOpen((o) => !o);
  const openMarkdown = () => setMdView(toMarkdown(editor!.getJSON() as Json));
  const saveMarkdown = async () => {
    const d = desktop(); if (!d || mdView === null) return;
    const base = (saver.name || name).replace(/\.[^.]+$/, '');
    const target = await d.saveDialog(`${base}.md`, docPrefs().defaultDir || undefined);
    if (!target) return;
    try { await d.writeFile(target, mdView); saver.setMessage(`Saved ${target.split(/[\\/]/).pop()} (the Word document was not touched)`); } catch (e) { saver.setMessage(`Could not save: ${(e as Error).message}`); }
  };
  const naturalSize = (src: string) => new Promise<{ w: number; h: number }>((res) => { const i = new window.Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => res({ w: 0, h: 0 }); i.src = src; });
  const imageSize = async (mode: 'reset' | 'original') => {
    const at = editor!.getAttributes('image') as { src?: string; crop?: { l: number; t: number; r: number; b: number } | null };
    if (!at.src) return;
    const n = await naturalSize(at.src);
    if (!n.w) return;
    const k = at.crop ?? { l: 0, t: 0, r: 0, b: 0 };
    const vw = n.w * (1 - k.l - k.r), vh = n.h * (1 - k.t - k.b);
    const w = mode === 'original' ? vw : Math.min(vw, 600);
    editor!.chain().focus().updateAttributes('image', { width: Math.round(w), height: Math.round(w * (vh / vw)) }).run();
  };
  const styleKey = (): 'title' | 'subtitle' | 'h1' | 'h2' | 'h3' | null => {
    const e = editor!;
    return e.isActive('heading', { level: 1 }) ? 'h1' : e.isActive('heading', { level: 2 }) ? 'h2' : e.isActive('heading', { level: 3 }) ? 'h3' : e.getAttributes('paragraph').pstyle === 'title' ? 'title' : e.getAttributes('paragraph').pstyle === 'subtitle' ? 'subtitle' : null;
  };
  const updateStyle = () => {
    const e = editor!;
    const ts = e.getAttributes('textStyle') as { fontSize?: string; fontFamily?: string; color?: string };
    const size = ts.fontSize ? parseFloat(ts.fontSize) : undefined;
    const k = styleKey();
    setStyles((s) => {
      if (!k) return { ...s, font: ts.fontFamily ?? s.font, size: size ?? s.size };
      return { ...s, [k]: { ...s[k], size: size ?? s[k].size, bold: e.isActive('bold') || s[k].bold, italic: e.isActive('italic'), color: ts.color ?? s[k].color, font: ts.fontFamily ?? s[k].font } };
    });
    e.chain().focus().unsetMark('bold').unsetMark('italic').unsetColor().unsetFontSize().unsetFontFamily().run(); // the style now carries them
    setDirty(true); setDirtyState(true);
    saver.setMessage(`${k ? STYLE_NAMES[k] : 'Normal text'} now matches the selection`);
  };
  const setStyle = (v: string) => {
    const run = editor!.chain().focus();
    if (v === 'h1' || v === 'h2' || v === 'h3') run.setHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run();
    else run.setParagraph().updateAttributes('paragraph', { pstyle: v === 'normal' ? null : v }).run();
  };
  const fontSize = (delta: number) => {
    const next = delta > 0 ? SIZES.find((z) => z > sizeNow) : [...SIZES].reverse().find((z) => z < sizeNow);
    if (next) editor!.chain().focus().setFontSize(`${next}pt`).run();
  };
  const insertImageFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { const src = String(reader.result); void naturalSize(src).then((n) => { const w = Math.min(n.w || 400, 600); editor!.chain().focus().setImage({ src, width: w, height: Math.round(w * ((n.h || 300) / (n.w || 400))) } as never).run(); }); };
    reader.readAsDataURL(file);
  };
  const insertPlain = (text: string) => {
    const lines = text.replace(/\r\n?/g, '\n').split('\n');
    editor!.chain().focus().insertContent(lines.length === 1 ? text : lines.map((l) => ({ type: 'paragraph', content: l ? [{ type: 'text', text: l }] : [] }))).run();
  };
  const edit = (name: 'cut' | 'copy' | 'paste' | 'selectAll') => { editor?.commands.focus(); const d = desktop(); if (d) d.editCommand(name); else document.execCommand(name === 'selectAll' ? 'selectAll' : name); };
  const pastePlain = async () => { editor?.commands.focus(); try { insertPlain(await navigator.clipboard.readText()); } catch { desktop()?.editCommand('pasteAndMatchStyle'); } };
  const openRecent = (p: string) => { if (!confirmLeave()) return; void desktop()?.openRecent(p).then((r) => { addOpened(r); navigate(editUrl(r.path)); }); };
  const reset = () => {
    if (prefs.confirmReset && !window.confirm('Throw away the changes made since the document was opened (or last saved)?')) return;
    autosave.clear(); setDirty(false); onReset();
  };

  // paste behaviour of Settings > Documents > Editing: plain text by default, Ctrl+Shift+V the other way round
  useEffect(() => {
    if (!editor || !prefs.pastePlain) return;
    let shift = false;
    const kd = (e: KeyboardEvent) => { shift = e.shiftKey && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v'; };
    const onPaste = (e: ClipboardEvent) => {
      const cd = e.clipboardData; if (!cd) return;
      const html = cd.getData('text/html');
      e.preventDefault(); e.stopPropagation();
      if (shift && html) editor.chain().focus().insertContent(html).run(); else insertPlain(cd.getData('text/plain'));
    };
    const dom = editor.view.dom;
    window.addEventListener('keydown', kd, true); dom.addEventListener('paste', onPaste, true);
    return () => { window.removeEventListener('keydown', kd, true); dom.removeEventListener('paste', onPaste, true); };
  }, [editor, prefs.pastePlain]); // eslint-disable-line react-hooks/exhaustive-deps

  // keyboard: the first TurboDocs' Google-Docs-style shortcuts
  useEffect(() => {
    if (!editor) return;
    const key = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      if (!mod) return;
      const stop = () => { e.preventDefault(); e.stopPropagation(); };
      if (k === 's') { stop(); if (mdView !== null) void saveMarkdown(); else void doSave(e.shiftKey); }
      else if (mdView !== null) return;
      else if (!e.shiftKey && !e.altKey && (k === 'f' || k === 'h')) { stop(); setFind((f) => ({ open: true, replace: k === 'h' || f.replace, n: f.n + 1 })); }
      else if (k === 'k' && !e.shiftKey) { stop(); setKeys((x) => ({ ...x, link: x.link + 1 })); }
      else if (e.key === '\\') { stop(); editor.chain().focus().unsetAllMarks().run(); }
      else if (e.altKey && ['0', '1', '2', '3'].includes(e.key)) { stop(); setStyle(e.key === '0' ? 'normal' : `h${e.key}`); }
      else if (e.altKey && k === 'w') { stop(); setKeys((x) => ({ ...x, width: x.width + 1 })); }
      else if (e.shiftKey && k === 'c' && !e.altKey) { stop(); setDialog('count'); }
      else if (e.key === ']' ) { stop(); editor.chain().focus().sinkListItem('listItem').run(); }
      else if (e.key === '[') { stop(); editor.chain().focus().liftListItem('listItem').run(); }
      else if (e.shiftKey && (e.key === '>' || e.key === '.')) { stop(); fontSize(1); }
      else if (e.shiftKey && (e.key === '<' || e.key === ',')) { stop(); fontSize(-1); }
      else if (e.shiftKey && k === 'x') { stop(); editor.chain().focus().toggleStrike().run(); }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  });

  const restore = async () => {
    if (!autosave.found || !editor) return;
    try {
      const r = await importDocx(autosave.found.bytes);
      editor.commands.setContent(r.doc); setStyles(r.styles);
      setDirty(true); setDirtyState(true); saver.setMessage('Restored the backed-up changes');
    } catch { saver.setMessage('The backup could not be read'); }
    autosave.dismiss();
  };

  if (!editor) return null;
  const pageFg = styles.pageColor ? (luminance(styles.pageColor) > 0.55 ? '#111111' : '#f2f2f2') : undefined;
  const menus = docMenus({
    editor, styles, mdView: mdView !== null, tabsOpen, zoom, hasFile: !!saver.path, recent, sizeNow,
    actions: {
      home: () => goHome(navigate), newDoc: () => goNew(navigate, 'docx'), newMd: () => goNew(navigate, 'md'), open: () => openFileDialog(navigate), openRecent,
      save: () => void doSave(), saveAs: () => void doSave(true), reset, preferences: () => { if (confirmLeave()) navigate('/settings?tab=docs'); }, quit: () => desktop()?.windowControl?.('close'),
      cut: () => edit('cut'), copy: () => edit('copy'), paste: () => edit('paste'), pastePlain: () => void pastePlain(), selectAll: () => edit('selectAll'),
      find: (replace) => setFind((f) => ({ open: true, replace, n: f.n + 1 })),
      toggleMarkdown: () => (mdView === null ? openMarkdown() : setMdView(null)), toggleTabs, width: () => setKeys((x) => ({ ...x, width: x.width + 1 })), zoomTo: (z) => setZoom(Math.min(400, Math.max(25, z))), fullscreen: () => desktop()?.windowControl?.('fullscreen'),
      image: () => fileInput.current?.click(), link: () => setKeys((x) => ({ ...x, link: x.link + 1 })), emoji: () => setDialog('emoji'), table: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: false }).run(),
      date: (t) => editor.chain().focus().insertContent(t).run(),
      setStyle, updateStyle, resetStyles: () => { setStyles((s) => ({ ...s, title: FACTORY_STYLES.title, subtitle: FACTORY_STYLES.subtitle, h1: FACTORY_STYLES.h1, h2: FACTORY_STYLES.h2, h3: FACTORY_STYLES.h3 })); setDirty(true); setDirtyState(true); },
      saveStyleDefaults: () => { setDocPrefs({ docFont: styles.font, docSize: styles.size, line: styles.line, after: styles.after, styles: { title: styles.title, subtitle: styles.subtitle, h1: styles.h1, h2: styles.h2, h3: styles.h3 } }); saver.setMessage('These styles are now the defaults for new documents'); },
      setPageColour: (c) => { setStyles((s) => ({ ...s, pageColor: c ?? undefined })); setDirty(true); setDirtyState(true); }, customPageColour: () => colourInput.current?.click(),
      cropImage: () => window.dispatchEvent(new Event('turbodocs:crop-image')), imageSize: (m) => void imageSize(m),
      wordCount: () => setDialog('count'), clearFormatting: () => editor.chain().focus().unsetAllMarks().run(), fontSize,
      lineHeight: (v) => editor.chain().focus().updateAttributes('paragraph', { lineHeight: v }).updateAttributes('heading', { lineHeight: v }).run(),
    },
  });
  return (
    <div className="flex h-full min-h-0 flex-col">
      <MenuBar menus={menus} label="Document menu" lead={<DocTitle name={saver.name} path={saver.path} dirty={dirty} />} trail={<DocActions path={saver.path} dirty={dirty} busy={saver.busy} onSave={() => void doSave()} onSaveAs={() => void doSave(true)} />} />
      {autosave.found && (
        <div role="alert" className="tk-expand mx-3 mb-2 flex flex-wrap items-center gap-2 rounded-theme border border-accent bg-accent/10 px-3 py-2 text-sm">
          <span className="flex-1">Unsaved changes from {new Date(autosave.found.at).toLocaleString()} were backed up. Restore them?</span>
          <button className="btn btn-accent text-sm" onClick={() => void restore()}>Restore</button>
          <button className="btn text-sm" onClick={() => { autosave.clear(); autosave.dismiss(); }}>Discard</button>
        </div>
      )}
      {warnings.length > 0 && (
        <div role="alert" className="mx-3 mb-2 rounded-theme border border-warn bg-warn/10 px-3 py-2 text-sm">
          <b>Parts of this document cannot be edited here:</b> {warnings.join(' ')} <span className="text-muted">Saving writes a new file without them (a copy of the original is kept); use Save as to keep the original untouched.</span>
        </div>
      )}
      {find.open && <FindBar replaceMode={find.replace} focusKey={find.n} count={hits?.count ?? 0} index={hits?.index ?? 0} onClose={closeFind}
        onSearch={(o) => editor.commands.setSearch(o)} onStep={(d) => editor.commands.findStep(d)} onReplace={(r) => editor.commands.replaceCurrent(r)} onReplaceAll={(r) => editor.commands.replaceAll(r)} />}
      {mdView === null && <Toolbar editor={editor} width={width} setWidth={setWidth} marginL={marginL} marginR={marginR} setMargins={(l, r) => { setMarginL(l); setMarginR(r); }} base={{ font: styles.font, size: styles.size }} widthKey={keys.width} linkKey={keys.link} onEmoji={() => setDialog('emoji')} />}
      {mdView !== null ? (
        <div className="tk-swap flex min-h-0 flex-1 flex-col gap-2 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="flex-1 text-muted">Markdown view: a plain-text rendering of this document. Ctrl+S saves a <b>.md</b> file; the Word document is never changed from here.</span>
            <button className="btn btn-accent text-sm" onClick={() => void saveMarkdown()}>Save as .md…</button>
            <button className="btn text-sm" onClick={() => setMdView(null)}>Back to the document</button>
          </div>
          <textarea aria-label="Markdown" className="input min-h-0 w-full flex-1 resize-none font-mono text-sm leading-relaxed" value={mdView} onChange={(e) => setMdView(e.target.value)} spellCheck={false} />
        </div>
      ) : (
        <div className="relative min-h-0 flex-1">
          <div className="h-full overflow-y-auto px-4 py-6" style={{ background: styles.pageColor, ['--page-fg' as string]: pageFg }}
            onWheel={(e) => { if (e.ctrlKey) { e.preventDefault(); setZoom(Math.min(400, Math.max(25, zoom + (e.deltaY < 0 ? 10 : -10)))); } }} onClick={(e) => { if (e.target === e.currentTarget) editor.chain().focus('end').run(); }}>
            <EditorContent editor={editor} className="docs-canvas mx-auto" style={{ maxWidth: width, paddingLeft: marginL, paddingRight: marginR, boxSizing: 'content-box', zoom: zoom / 100, ...styleVars(styles) }}
              // a click in the empty space below the text lands on the editor's own box, which would leave the caret at the very start: put it at the end instead
              onClick={(e) => { if ((e.target as HTMLElement).classList.contains('docs-editor')) editor.chain().focus('end').run(); }} />
          </div>
          <button type="button" className="btn btn-ghost absolute left-3 top-3 z-10 !p-1.5" aria-label="Document tabs and outline" title="Document tabs and outline" aria-pressed={tabsOpen} onClick={toggleTabs} style={{ display: tabsOpen ? 'none' : undefined }}><ListTree size={18} /></button>
          {tabsOpen && <OutlinePanel editor={editor} onClose={() => setTabsOpen(false)} />}
        </div>
      )}
      <StatusBar editor={mdView === null ? editor : null} zoom={zoom} setZoom={setZoom} message={saver.message} showWords={prefs.showWordCount} showZoom={prefs.showZoom} />
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/gif,image/bmp" hidden onChange={(e) => { insertImageFile(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={colourInput} type="color" hidden aria-label="Page colour" onChange={(e) => { setStyles((s) => ({ ...s, pageColor: e.target.value })); setDirty(true); setDirtyState(true); }} />
      {dialog === 'count' && <WordCountDialog editor={editor} onClose={() => setDialog(null)} />}
      {dialog === 'emoji' && <EmojiDialog onPick={(c) => editor.chain().focus().insertContent(c).run()} onClose={() => setDialog(null)} />}
    </div>
  );
}
