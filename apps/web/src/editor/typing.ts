import { Extension, InputRule } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { emojiForCode } from './emoji.ts';

export interface TypingOptions { dashes: boolean; smartQuotes: boolean; emojiCodes: boolean; highlightLine: boolean }

const replaceTyped = (text: string) => ({ state, range }: { state: { tr: { insertText(t: string, f: number, to: number): unknown } }; range: { from: number; to: number } }) => { state.tr.insertText(text, range.from, range.to); };

/** The editing options of the first TurboDocs' Preferences: `--` to a dash, curly quotes, `:smile:`, and a highlighted current line. */
export const Typing = Extension.create<TypingOptions>({
  name: 'typing',
  addOptions() { return { dashes: true, smartQuotes: false, emojiCodes: true, highlightLine: false }; },
  addInputRules() {
    const rules: InputRule[] = [];
    if (this.options.dashes) rules.push(new InputRule({ find: /--$/, handler: replaceTyped('—') }));
    if (this.options.smartQuotes) {
      // a quote after a space, bracket, dash or the start of a line opens; any other closes
      const quote = (find: RegExp, open: string, close: string) => new InputRule({
        find,
        handler: ({ state, range, match }) => { const before = match[1] ?? ''; state.tr.insertText(before + (before === '' || /[\s([{—–]/.test(before) ? open : close), range.from, range.to); },
      });
      rules.push(quote(/(^|[\s([{—–\w.,!?)\]}])"$/, '“', '”'), quote(/(^|[\s([{—–\w.,!?)\]}])'$/, '‘', '’'));
    }
    if (this.options.emojiCodes) {
      rules.push(new InputRule({
        find: /:([a-z0-9_+-]{2,}):$/i,
        handler: ({ state, range, match }) => { const e = emojiForCode(match[1]); if (!e) return null; state.tr.insertText(e, range.from, range.to); return undefined; },
      }));
    }
    return rules;
  },
  addProseMirrorPlugins() {
    if (!this.options.highlightLine) return [];
    return [new Plugin({
      key: new PluginKey('currentLine'),
      props: {
        decorations(state) {
          const { $from, empty } = state.selection;
          if (!empty || $from.depth < 1) return null;
          const d = $from.depth;
          return DecorationSet.create(state.doc, [Decoration.node($from.before(d), $from.after(d), { class: 'cur-line' })]);
        },
      },
    })];
  },
});
