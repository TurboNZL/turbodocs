import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import { findInString, NO_SEARCH, replacementFor, type FindOptions, type Range } from './find.ts';

/** Find and replace for the Word editor: matches are decorations (no change to the document until you replace). */
export interface SearchState { opts: FindOptions; matches: Range[]; current: number }
export const searchKey = new PluginKey<SearchState>('turbodocsSearch');

/** Matches per text block; positions are document positions. A picture counts as one character, so offsets line up with the text. */
export function findInDoc(doc: PMNode, o: FindOptions): Range[] {
  const out: Range[] = [];
  if (!o.query) return out;
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    const text = node.textBetween(0, node.content.size, undefined, '￼');
    for (const m of findInString(text, o)) out.push({ from: pos + 1 + m.from, to: pos + 1 + m.to });
    return false;
  });
  return out;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    search: {
      setSearch: (o: FindOptions) => ReturnType;
      findStep: (dir: 1 | -1) => ReturnType;
      replaceCurrent: (replacement: string) => ReturnType;
      replaceAll: (replacement: string) => ReturnType;
    };
  }
}

export const Search = Extension.create({
  name: 'search',
  addProseMirrorPlugins() {
    return [new Plugin<SearchState>({
      key: searchKey,
      state: {
        init: () => ({ opts: NO_SEARCH, matches: [], current: 0 }),
        apply(tr, prev, _old, state) {
          const meta = tr.getMeta(searchKey) as { opts?: FindOptions; current?: number } | undefined;
          if (!meta && !tr.docChanged) return prev;
          const opts = meta?.opts ?? prev.opts;
          const matches = findInDoc(state.doc, opts);
          const wanted = meta?.current ?? prev.current;
          return { opts, matches, current: matches.length ? Math.min(Math.max(wanted, 0), matches.length - 1) : 0 };
        },
      },
      props: {
        decorations(state) {
          const s = searchKey.getState(state);
          if (!s || !s.matches.length) return null;
          return DecorationSet.create(state.doc, s.matches.map((m, i) => Decoration.inline(m.from, m.to, { class: i === s.current ? 'find-hit find-current' : 'find-hit' })));
        },
      },
    })];
  },
  addCommands() {
    return {
      setSearch: (o) => ({ tr, dispatch }) => { if (dispatch) dispatch(tr.setMeta(searchKey, { opts: o, current: 0 })); return true; },
      findStep: (dir) => ({ state, tr, dispatch }) => {
        const s = searchKey.getState(state);
        if (!s || !s.matches.length) return false;
        const current = (s.current + dir + s.matches.length) % s.matches.length;
        const m = s.matches[current];
        if (dispatch) dispatch(tr.setMeta(searchKey, { current }).setSelection(TextSelection.create(state.doc, m.from, m.to)).scrollIntoView());
        return true;
      },
      replaceCurrent: (replacement) => ({ state, tr, dispatch }) => {
        const s = searchKey.getState(state);
        const m = s?.matches[s.current];
        if (!s || !m) return false;
        if (dispatch) dispatch(tr.insertText(replacementFor(state.doc.textBetween(m.from, m.to, undefined, '￼'), s.opts, replacement), m.from, m.to).setMeta(searchKey, { current: s.current }));
        return true;
      },
      replaceAll: (replacement) => ({ state, tr, dispatch }) => {
        const s = searchKey.getState(state);
        if (!s || !s.matches.length) return false;
        if (dispatch) for (const m of [...s.matches].reverse()) tr.insertText(replacementFor(state.doc.textBetween(m.from, m.to, undefined, '￼'), s.opts, replacement), m.from, m.to);
        return true;
      },
    };
  },
});
