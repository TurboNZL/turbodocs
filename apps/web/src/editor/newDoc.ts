import { FACTORY_STYLES, type DocStyles } from './docxImport.ts';
import { docPrefs } from '../lib/docPrefs.ts';

/** The text styles of a NEW document: the factory ones (the first TurboDocs') with the person's Settings > Documents defaults on top. */
export function newDocStyles(): DocStyles {
  const p = docPrefs();
  const s: DocStyles = { ...FACTORY_STYLES, font: p.docFont || FACTORY_STYLES.font, size: p.docSize, line: p.line, after: p.after };
  for (const k of ['title', 'subtitle', 'h1', 'h2', 'h3'] as const) s[k] = { ...FACTORY_STYLES[k], ...(p.styles[k] ?? {}) };
  return s;
}
