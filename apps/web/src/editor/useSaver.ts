import { useRef, useState } from 'react';
import { desktop } from '../lib/settings.ts';
import { setDirty } from '../lib/dirty.ts';

/**
 * Save and Save as for one open document. `getBytes` makes the file's content. A file that has things the editor cannot keep (`warnings`)
 * is only overwritten after the person agrees once; Save as always writes a new file and leaves the original alone.
 */
export function useSaver({ path, name, warnings, getBytes }: { path: string | null; name: string; warnings: string[]; getBytes: () => Promise<Uint8Array | string> }) {
  const [current, setCurrent] = useState<{ path: string | null; name: string }>({ path, name });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const agreed = useRef(false);

  async function save(as = false): Promise<boolean> {
    const d = desktop();
    if (!d) { setMessage('Saving works in the desktop app.'); return false; }
    setBusy(true);
    try {
      let target = current.path;
      if (!target || as) {
        target = await d.saveDialog(current.name);
        if (!target) return false;
      } else if (warnings.length && !agreed.current) {
        const ok = window.confirm(`This document contains things TurboDocs cannot edit:\n\n• ${warnings.join('\n• ')}\n\nSaving writes a new Word file without them. A copy of the original is kept in the app's backups.\n\nSave anyway? (Cancel, then use Save as, to keep the original untouched.)`);
        if (!ok) return false;
        agreed.current = true;
      }
      await d.writeFile(target, await getBytes());
      setCurrent({ path: target, name: target.split(/[\\/]/).pop() ?? current.name });
      setDirty(false);
      setMessage(`Saved ${target.split(/[\\/]/).pop()}`);
      return true;
    } catch (e) {
      setMessage(`Could not save: ${(e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')}`);
      return false;
    } finally { setBusy(false); }
  }
  return { ...current, message, setMessage, busy, save };
}
