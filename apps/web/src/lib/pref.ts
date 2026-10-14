import { useCallback, useState } from 'react';

/** A small per-device preference kept in localStorage (the page works without it when storage is blocked). */
type Widen<T> = T extends number ? number : string;
export function usePref<T extends string | number>(key: string, initial: T): [Widen<T>, (v: Widen<T>) => void] {
  const [v, setV] = useState<Widen<T>>(() => {
    try { const s = localStorage.getItem(`turbodocs.${key}`); if (s === null) return initial as Widen<T>; return (typeof initial === 'number' ? Number(s) || initial : s) as Widen<T>; } catch { return initial as Widen<T>; }
  });
  const set = useCallback((n: Widen<T>) => { setV(n); try { localStorage.setItem(`turbodocs.${key}`, String(n)); } catch { /* storage blocked */ } }, [key]);
  return [v, set];
}
