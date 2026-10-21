import { useCallback, useEffect, useState } from 'react';

/** A small per-device preference kept in localStorage (the page works without it when storage is blocked). */
type Widen<T> = T extends number ? number : string;
export function usePref<T extends string | number>(key: string, initial: T): [Widen<T>, (v: Widen<T>) => void] {
  const [v, setV] = useState<Widen<T>>(() => {
    try { const s = localStorage.getItem(`turbodocs.${key}`); if (s === null) return initial as Widen<T>; return (typeof initial === 'number' ? Number(s) || initial : s) as Widen<T>; } catch { return initial as Widen<T>; }
  });
  const set = useCallback((n: Widen<T>) => { setV(n); try { localStorage.setItem(`turbodocs.${key}`, String(n)); } catch { /* storage blocked */ } window.dispatchEvent(new CustomEvent('turbodocs:pref', { detail: { key, value: n } })); }, [key]);
  // another part of the app changed it (Settings changes the layout the shell draws)
  useEffect(() => {
    const on = (e: Event) => { const d = (e as CustomEvent<{ key: string; value: Widen<T> }>).detail; if (d.key === key) setV(d.value); };
    window.addEventListener('turbodocs:pref', on); return () => window.removeEventListener('turbodocs:pref', on);
  }, [key]);
  return [v, set];
}
