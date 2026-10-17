import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';

/**
 * Document tabs, like the first TurboDocs'. A tab is a paragraph carrying the attribute `tab` (`tdtab_<n>`): its text is the tab's title and it starts a section
 * that runs to the next such paragraph. In the .docx it is the same paragraph inside a bookmark of that name, so Word shows an ordinary document with a title
 * line per tab. The plugin hides every section except the active one (none active = show all).
 */
export const tabsKey = new PluginKey<{ active: number | null }>('docTabs');

export interface TabInfo { index: number; title: string; pos: number; size: number; implicit: boolean; tab: string }

/** The tabs of a document. If content comes before the first marker it forms an implicit first tab. */
export function listTabs(doc: PMNode): TabInfo[] {
  const out: TabInfo[] = [];
  let first = true;
  doc.forEach((node, pos) => {
    const isMark = node.type.name === 'paragraph' && !!node.attrs.tab;
    if (first && !isMark && out.length === 0) out.push({ index: 0, title: 'Untitled tab', pos: 0, size: 0, implicit: true, tab: '' });
    first = false;
    if (isMark) out.push({ index: out.length, title: node.textContent.trim() || `Tab ${out.length + 1}`, pos, size: node.nodeSize, implicit: false, tab: String(node.attrs.tab) });
  });
  return out.length > 1 || (out.length === 1 && !out[0].implicit) ? out : [];
}
/** Start and end position of a tab's section (the marker paragraph is the section's first block). */
export function tabRange(doc: PMNode, index: number): { from: number; to: number } | null {
  const tabs = listTabs(doc);
  const t = tabs[index];
  if (!t) return null;
  const next = tabs[index + 1];
  return { from: t.implicit ? 0 : t.pos, to: next ? next.pos : doc.content.size };
}
export const nextTabName = (doc: PMNode) => {
  const used = new Set<number>();
  doc.descendants((n) => { const m = /^tdtab_(\d+)$/.exec(String(n.attrs.tab ?? '')); if (m) used.add(Number(m[1])); });
  let i = 1; while (used.has(i)) i++;
  return `tdtab_${i}`;
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> { docTabs: { setActiveTab: (index: number | null) => ReturnType } }
}

export const DocTabs = Extension.create({
  name: 'docTabs',
  addCommands() {
    return { setActiveTab: (index) => ({ tr, dispatch }) => { if (dispatch) dispatch(tr.setMeta(tabsKey, { active: index })); return true; } };
  },
  addProseMirrorPlugins() {
    return [new Plugin({
      key: tabsKey,
      state: {
        init: () => ({ active: null as number | null }),
        apply: (tr, v) => { const m = tr.getMeta(tabsKey) as { active: number | null } | undefined; return m ? { active: m.active } : v; },
      },
      props: {
        decorations(state) {
          const active = tabsKey.getState(state)?.active;
          if (active === null || active === undefined) return null;
          const decos: Decoration[] = [];
          let idx = 0;
          const implicitFirst = state.doc.firstChild ? !(state.doc.firstChild.type.name === 'paragraph' && state.doc.firstChild.attrs.tab) : false;
          if (!implicitFirst) idx = -1;
          state.doc.forEach((node, pos) => {
            if (node.type.name === 'paragraph' && node.attrs.tab) idx++;
            if (idx !== active) decos.push(Decoration.node(pos, pos + node.nodeSize, { class: 'tab-hidden' }));
          });
          return DecorationSet.create(state.doc, decos);
        },
      },
    })];
  },
});
