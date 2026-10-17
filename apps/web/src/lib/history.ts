import { useCallback, useRef, useState } from 'react';

/** Undo and redo for a value that is replaced, never changed in place (a workbook, a presentation). */
export function useHistory<T>(initial: T, limit = 200) {
  const [value, setValue] = useState(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const [, bump] = useState(0);
  const latest = useRef(value); latest.current = value;
  const set = useCallback((next: T | ((v: T) => T), record = true) => {
    const n = typeof next === 'function' ? (next as (v: T) => T)(latest.current) : next;
    if (n === latest.current) return;
    if (record) { past.current.push(latest.current); if (past.current.length > limit) past.current.shift(); future.current = []; }
    latest.current = n; setValue(n); bump((x) => x + 1);
  }, [limit]);
  const undo = useCallback(() => { const p = past.current.pop(); if (p === undefined) return; future.current.push(latest.current); latest.current = p; setValue(p); bump((x) => x + 1); }, []);
  const redo = useCallback(() => { const f = future.current.pop(); if (f === undefined) return; past.current.push(latest.current); latest.current = f; setValue(f); bump((x) => x + 1); }, []);
  return { value, set, undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}
