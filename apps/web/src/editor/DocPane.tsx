import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { editorExtensions } from './extensions.ts';
import { exportDocx } from './docxExport.ts';
import type { DocStyles, Json } from './docxImport.ts';
import { styleVars } from './docStyles.ts';
import { Toolbar } from './Toolbar.tsx';
import { StatusBar } from './StatusBar.tsx';
import { DocHeader } from './DocHeader.tsx';
import { useSaver } from './useSaver.ts';
import { usePref } from '../lib/pref.ts';
import { setDirty } from '../lib/dirty.ts';
import { useState } from 'react';

/**
 * The Word-document editor. Pageless like the first TurboDocs: the text sits on the theme's own background in a centred column (width and
 * zoom are the person's), no sheet of paper.
 */
export function DocPane({ initial, path, name, warnings, styles }: { initial: Json; path: string | null; name: string; warnings: string[]; styles: DocStyles }) {
  const [width, setWidth] = usePref('editor.width', 760);
  const [zoom, setZoom] = usePref('editor.zoom', 100);
  const [dirty, setDirtyState] = useState(false);
  const editor = useEditor({
    extensions: editorExtensions,
    content: initial,
    editorProps: { attributes: { class: 'docs-editor', spellcheck: 'true', 'aria-label': 'Document' } },
    onUpdate: () => { setDirty(true); setDirtyState(true); },
  });
  const saver = useSaver({ path, name, warnings, getBytes: async () => (await exportDocx(editor!.getJSON() as Json, styles)).bytes });
  const doSave = async (as = false) => { if (await saver.save(as)) setDirtyState(false); };

  useEffect(() => () => setDirty(false), []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void doSave(e.shiftKey); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  if (!editor) return null;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <DocHeader name={saver.name} path={saver.path} dirty={dirty} busy={saver.busy} onSave={() => void doSave()} onSaveAs={() => void doSave(true)} />
      {warnings.length > 0 && (
        <div role="alert" className="mx-3 mb-2 rounded-theme border border-warn bg-warn/10 px-3 py-2 text-sm">
          <b>Parts of this document cannot be edited here:</b> {warnings.join(' ')} <span className="text-muted">Saving writes a new file without them (a copy of the original is kept); use Save as to keep the original untouched.</span>
        </div>
      )}
      <Toolbar editor={editor} width={width} setWidth={setWidth} base={{ font: styles.font, size: styles.size }} />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6" onWheel={(e) => { if (e.ctrlKey) { e.preventDefault(); setZoom(Math.min(400, Math.max(25, zoom + (e.deltaY < 0 ? 10 : -10)))); } }} onClick={(e) => { if (e.target === e.currentTarget) editor.chain().focus('end').run(); }}>
        <EditorContent editor={editor} className="docs-canvas mx-auto" style={{ maxWidth: width, zoom: zoom / 100, ...styleVars(styles) }}
          // a click in the empty space below the text lands on the editor's own box, which would leave the caret at the very start: put it at the end instead
          onClick={(e) => { if ((e.target as HTMLElement).classList.contains('docs-editor')) editor.chain().focus('end').run(); }} />
      </div>
      <StatusBar editor={editor} zoom={zoom} setZoom={setZoom} message={saver.message} />
    </div>
  );
}
