import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import { ChevronRight, Plus, Trash2, X } from 'lucide-react';
import { listTabs, nextTabName, tabRange, tabsKey } from './tabs.ts';

/**
 * The floating panel the ☰ button opens (View > Document tabs): the document's tabs (one section each, shown one at a time) and the outline of the headings in
 * the open tab. Tabs are stored as bookmarks, so the file stays an ordinary Word document with a title line per tab.
 */
export function OutlinePanel({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const st = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const tabs = listTabs(e.state.doc);
      const active = tabsKey.getState(e.state)?.active ?? null;
      const range = active !== null ? tabRange(e.state.doc, active) : null;
      const heads: { pos: number; level: number; text: string; kind: string }[] = [];
      e.state.doc.descendants((n, pos) => {
        if (range && (pos < range.from || pos >= range.to)) return false;
        if (n.type.name === 'heading' && n.textContent.trim()) heads.push({ pos, level: Number(n.attrs.level), text: n.textContent, kind: 'h' });
        else if (n.type.name === 'paragraph' && n.attrs.pstyle === 'title' && n.textContent.trim()) heads.push({ pos, level: 0, text: n.textContent, kind: 't' });
        return false;
      });
      return { tabs: tabs.map((t) => ({ ...t })), active, heads, key: JSON.stringify([tabs.map((t) => [t.title, t.pos]), active, heads]) };
    },
    equalityFn: (a, b) => (a && b ? a.key === b.key : a === b),
  });
  const [editing, setEditing] = useState<number | null>(null);
  if (!st) return null;
  const addTab = () => {
    const { doc } = editor.state;
    if (!listTabs(doc).length) {
      // the first tab is made explicit: everything so far moves under a "Tab 1" title, then the new tab follows
      editor.chain().insertContentAt(0, { type: 'paragraph', attrs: { tab: nextTabName(doc) }, content: [{ type: 'text', text: 'Tab 1' }] }).run();
    }
    const now = editor.state.doc;
    editor.chain().insertContentAt(now.content.size, [{ type: 'paragraph', attrs: { tab: nextTabName(now) }, content: [{ type: 'text', text: `Tab ${listTabs(now).length + 1}` }] }, { type: 'paragraph' }]).run();
    const n = listTabs(editor.state.doc).length - 1;
    editor.commands.setActiveTab(n);
    jumpToTab(n);
  };
  const jumpToTab = (i: number) => {
    const doc = editor.state.doc;
    const t = listTabs(doc)[i], r = tabRange(doc, i);
    if (!t || !r) return;
    editor.commands.setActiveTab(i);
    // the caret goes to the first line under the tab's title (the editor takes the keyboard back from the panel)
    const body = t.implicit ? 1 : t.pos + t.size + 1;
    editor.chain().focus().setTextSelection(Math.min(body, r.to > body ? r.to - 1 : doc.content.size)).scrollIntoView().run();
  };
  const rename = (i: number, title: string) => {
    const t = listTabs(editor.state.doc)[i];
    if (!t || t.implicit) return;
    editor.chain().command(({ tr, state }) => {
      const from = t.pos + 1, to = t.pos + t.size - 1;
      tr.replaceWith(from, to, title ? state.schema.text(title) : []);
      return true;
    }).run();
  };
  const removeTab = (i: number) => {
    const r = tabRange(editor.state.doc, i);
    if (!r) return;
    if (!window.confirm('Delete this tab and everything in it?')) return;
    editor.chain().command(({ tr }) => { tr.delete(r.from, r.to); return true; }).run();
    const left = listTabs(editor.state.doc);
    editor.commands.setActiveTab(left.length ? Math.min(i, left.length - 1) : null);
  };
  const goHeading = (pos: number) => { editor.chain().setTextSelection(pos + 1).scrollIntoView().run(); };
  return (
    <aside aria-label="Document tabs and outline" className="bt-menu tk-slide-in absolute left-3 top-3 z-20 flex max-h-[70vh] w-64 flex-col overflow-hidden p-0 text-sm">
      <div className="flex items-center gap-1 px-3 py-2"><b className="flex-1">Tabs</b>
        <button type="button" className="btn btn-ghost !p-1" aria-label="Add tab" title="Add tab" onClick={addTab}><Plus size={14} /></button>
        <button type="button" className="btn btn-ghost !p-1" aria-label="Close panel" onClick={onClose}><X size={14} /></button></div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
        {st.tabs.length === 0 && <p className="px-2 pb-2 text-xs text-muted">One long document so far. Add a tab to split it into sections you open one at a time.</p>}
        {st.tabs.map((t) => (
          <div key={t.index} className={`group flex items-center gap-1 rounded-theme px-2 py-1 ${st.active === t.index ? 'bg-hover font-medium' : ''}`}>
            {editing === t.index
              ? <input autoFocus className="input !py-0.5 text-sm" defaultValue={t.title} aria-label="Tab name" onBlur={(e) => { rename(t.index, e.target.value.trim()); setEditing(null); }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(null); }} />
              : <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => jumpToTab(t.index)} onDoubleClick={() => !t.implicit && setEditing(t.index)} title="Double-click to rename">{t.title}</button>}
            {!t.implicit && <button type="button" className="opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`Delete ${t.title}`} onClick={() => removeTab(t.index)}><Trash2 size={13} /></button>}
          </div>
        ))}
        {st.tabs.length > 0 && <button type="button" className="mt-1 w-full px-2 py-1 text-left text-xs text-accent" onClick={() => editor.commands.setActiveTab(st.active === null ? 0 : null)}>{st.active === null ? 'Show one tab at a time' : 'Show all tabs'}</button>}
        <div className="mt-2 border-t border-line px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted">Outline</div>
        {st.heads.length === 0 && <p className="px-2 text-xs text-muted">Headings you add (Title, Heading 1 to 3) are listed here.</p>}
        {st.heads.map((h) => (
          <button key={h.pos} type="button" className="flex w-full items-center gap-1 truncate rounded-theme px-2 py-0.5 text-left hover:bg-hover" style={{ paddingLeft: 8 + h.level * 12 }} onClick={() => goHeading(h.pos)}>
            {h.level > 0 && <ChevronRight size={10} className="shrink-0 text-muted" />}<span className={`truncate ${h.level <= 1 ? 'font-medium' : ''}`}>{h.text}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
