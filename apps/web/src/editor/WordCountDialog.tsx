import type { Editor } from '@tiptap/react';
import { Dialog } from '../components/Dialog.tsx';

const count = (t: string) => ({
  words: t.split(/\s+/).filter(Boolean).length,
  chars: t.replace(/\n/g, '').length,
  charsNoSpace: t.replace(/\s/g, '').length,
  sentences: (t.match(/[^.!?…]+[.!?…]+(\s|$)/g) ?? []).length || (t.trim() ? 1 : 0),
});

/** Tools > Word count (Ctrl+Shift+C): the whole document, and the selection when there is one. */
export function WordCountDialog({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const doc = editor.state.doc;
  const { from, to, empty } = editor.state.selection;
  const all = doc.textBetween(0, doc.content.size, '\n', ' ');
  let paragraphs = 0; doc.descendants((n) => { if (n.isTextblock && n.textContent.trim()) paragraphs++; });
  const a = count(all), s = empty ? null : count(doc.textBetween(from, to, '\n', ' '));
  const rows: [string, number, number | undefined][] = [['Words', a.words, s?.words], ['Characters', a.chars, s?.chars], ['Characters without spaces', a.charsNoSpace, s?.charsNoSpace], ['Sentences', a.sentences, s?.sentences], ['Paragraphs', paragraphs, undefined]];
  const minutes = Math.max(1, Math.round(a.words / 230));
  return (
    <Dialog title="Word count" onClose={onClose} footer={<button className="btn btn-accent" autoFocus onClick={onClose}>Close</button>}>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs text-muted"><th /><th className="text-right font-medium">Document</th>{s && <th className="text-right font-medium">Selection</th>}</tr></thead>
        <tbody>{rows.map(([l, v, sv]) => <tr key={l}><td className="py-1">{l}</td><td className="text-right tabular-nums">{v.toLocaleString()}</td>{s && <td className="text-right tabular-nums">{sv === undefined ? '' : sv.toLocaleString()}</td>}</tr>)}</tbody>
      </table>
      <p className="mt-3 text-xs text-muted">About {minutes} {minutes === 1 ? 'minute' : 'minutes'} to read.</p>
    </Dialog>
  );
}
