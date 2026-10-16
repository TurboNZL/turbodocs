import type { CSSProperties } from 'react';
import { fontStack } from './fonts.ts';
import type { DocStyles, StyleDef } from './docxImport.ts';

const px = (pt: number) => `${Math.round(((pt * 96) / 72) * 1000) / 1000}px`;

/** The document's text styles as CSS variables on the canvas (index.css `.docs-editor` reads them; the fallbacks are the first TurboDocs' values). */
export function styleVars(s: DocStyles): CSSProperties {
  const v: Record<string, string> = { '--ds-font': fontStack(s.font), '--ds-size': px(s.size), '--ds-line': String(s.line), '--ds-after': `${s.after}px` };
  const named: [string, StyleDef][] = [['title', s.title], ['subtitle', s.subtitle], ['h1', s.h1], ['h2', s.h2], ['h3', s.h3]];
  for (const [k, d] of named) {
    v[`--ds-${k}-size`] = d.size ? px(d.size) : 'var(--ds-size)';
    v[`--ds-${k}-weight`] = d.bold ? '700' : '400';
    v[`--ds-${k}-style`] = d.italic ? 'italic' : 'normal';
    v[`--ds-${k}-color`] = d.color ?? 'inherit';
    v[`--ds-${k}-font`] = d.font ? fontStack(d.font) : 'inherit';
    v[`--ds-${k}-before`] = `${d.before ?? 0}px`;
    v[`--ds-${k}-after`] = `${d.after ?? 0}px`;
  }
  return v as CSSProperties;
}
