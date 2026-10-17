import { useSyncExternalStore } from 'react';
import type { StyleDef } from '../editor/docxImport.ts';

/**
 * Preferences of the Docs editor, the ones the first TurboDocs' Preferences window had (docs/development/LEGACY_REFERENCE.md): general, document defaults for
 * NEW documents, per-style defaults and the editing options. One JSON value in localStorage, read through `useDocPrefs()`.
 */
export interface DocPrefs {
  backupSec: number; showWordCount: boolean; showZoom: boolean; reopenLast: boolean; confirmReset: boolean; defaultDir: string;
  docFont: string; docSize: number; line: number; after: number; width: number; marginL: number; marginR: number;
  styles: Partial<Record<'title' | 'subtitle' | 'h1' | 'h2' | 'h3', StyleDef>>;
  mdShortcuts: boolean; dashes: boolean; smartQuotes: boolean; emojiCodes: boolean; highlightLine: boolean; pastePlain: boolean;
}
export const DEFAULT_PREFS: DocPrefs = {
  backupSec: 1.5, showWordCount: true, showZoom: true, reopenLast: false, confirmReset: true, defaultDir: '',
  docFont: '', docSize: 11, line: 1.18, after: 6, width: 760, marginL: 0, marginR: 0, styles: {},
  mdShortcuts: true, dashes: true, smartQuotes: false, emojiCodes: true, highlightLine: false, pastePlain: false,
};
const KEY = 'turbodocs.docprefs';
const subs = new Set<() => void>();
let cache: DocPrefs | null = null;
function read(): DocPrefs {
  if (cache) return cache;
  try { cache = { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<DocPrefs>) }; } catch { cache = { ...DEFAULT_PREFS }; }
  return cache;
}
export const docPrefs = (): DocPrefs => read();
export function setDocPrefs(patch: Partial<DocPrefs>): void {
  cache = { ...read(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* storage blocked: the change lasts until the window closes */ }
  subs.forEach((f) => f());
}
export const resetDocPrefs = () => { cache = { ...DEFAULT_PREFS }; try { localStorage.removeItem(KEY); } catch { /* ignore */ } subs.forEach((f) => f()); };
export const useDocPrefs = (): DocPrefs => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, read);

/** the last document that was open, for "Reopen the last document on startup" */
export const rememberLastFile = (path: string | null) => { try { if (path) localStorage.setItem('turbodocs.lastfile', path); } catch { /* ignore */ } };
export const lastFile = (): string => { try { return localStorage.getItem('turbodocs.lastfile') ?? ''; } catch { return ''; } };
