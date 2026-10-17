import { useState } from 'react';
import { Dialog } from '../components/Dialog.tsx';
import { EMOJI_GROUPS, searchEmoji } from './emoji.ts';

/** Insert > Emoji: search by word, pick one. Emoji can also be typed as :smile: (Settings > Documents > Editing). */
export function EmojiDialog({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const list = searchEmoji(q);
  return (
    <Dialog title="Emoji" onClose={onClose} wide>
      <input autoFocus className="input mb-3 !py-1.5 text-sm" placeholder="Search: heart, fire, party…" aria-label="Search emoji" value={q} onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && list[0]) { onPick(list[0].char); onClose(); } }} />
      {list.length === 0 && <p className="text-sm text-muted">No emoji with that word.</p>}
      {(q ? [''] : EMOJI_GROUPS).map((g) => (
        <section key={g || 'results'} className="mb-3">
          {g && <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">{g}</h3>}
          <div className="grid grid-cols-8 gap-1 sm:grid-cols-10">
            {list.filter((e) => !g || e.group === g).map((e) => (
              <button key={e.char + e.words} type="button" title={e.words.split(' ').join(', ')} aria-label={e.words.split(' ')[0]} className="btn btn-ghost !p-1 text-xl leading-none" onClick={() => { onPick(e.char); onClose(); }}>{e.char}</button>
            ))}
          </div>
        </section>
      ))}
    </Dialog>
  );
}
