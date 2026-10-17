import { useCallback, useEffect, useRef, useState } from 'react';
import { desktop } from '../lib/settings.ts';
import { useDocPrefs } from '../lib/docPrefs.ts';
import { setLeaveHook } from '../lib/dirty.ts';

/**
 * Crash backups, as in the first TurboDocs: `touch()` after every edit saves a copy of the document to the app's autosave folder once the person stops typing
 * for `backupSec` seconds. Opening the document again finds the copy (`found`) and the editor offers it back. Saving removes it (`clear()`).
 */
export function useAutosave(key: string, getBytes: () => Promise<Uint8Array | string>) {
  const d = desktop();
  const { backupSec } = useDocPrefs();
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef(getBytes);
  latest.current = getBytes;
  const [found, setFound] = useState<{ at: number; bytes: Uint8Array } | null>(null);
  useEffect(() => { let alive = true; void d?.autosaveRead(key).then((r) => { if (alive) setFound(r); }).catch(() => undefined); return () => { alive = false; }; }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const touch = useCallback(() => {
    if (!d) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void latest.current().then((b) => d.autosaveWrite(key, b)).catch((e) => console.error('autosave failed:', e)); }, Math.max(0.3, backupSec) * 1000);
  }, [key, backupSec]); // eslint-disable-line react-hooks/exhaustive-deps
  const clear = useCallback(() => { window.clearTimeout(timer.current); void d?.autosaveClear(key).catch(() => undefined); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setLeaveHook(clear); return () => { setLeaveHook(null); window.clearTimeout(timer.current); }; }, [clear]);
  return { found, dismiss: () => setFound(null), touch, clear };
}
