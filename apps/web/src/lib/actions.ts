import type { NavigateFunction } from 'react-router-dom';
import { desktop, type OpenRequest } from './settings.ts';
import { addOpened, editUrl } from './opened.ts';
import { confirmLeave } from './dirty.ts';
import { docPrefs } from './docPrefs.ts';

/** Open dialog -> the first file whose app is installed opens in it; the rest are listed on Home. */
export function openFileDialog(navigate: NavigateFunction): void {
  const d = desktop();
  if (!d || !confirmLeave()) return;
  void d.openDialog(docPrefs().defaultDir || undefined).then((rs) => { rs.forEach(addOpened); const first = rs.find((r: OpenRequest) => r.module && r.installed); navigate(first ? editUrl(first.path) : '/'); });
}
/** A new, empty file of this kind. `n` makes the URL unique so a second "New" while a new file is open starts over. */
export const newUrl = (kind: 'docx' | 'md' | 'xlsx' | 'pptx') => `/edit?new=${kind}&n=${Date.now()}`;
export function goNew(navigate: NavigateFunction, kind: 'docx' | 'md' | 'xlsx' | 'pptx'): void { if (confirmLeave()) navigate(newUrl(kind)); }
export function goHome(navigate: NavigateFunction): void { if (confirmLeave()) navigate('/'); }
