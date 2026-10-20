import type { CSSProperties } from 'react';
import { fontStack } from '../editor/fonts.ts';
import { DEFAULT_SIZE, pxOfPt, type Para, type Run } from './model.ts';

/** How a paragraph of a slide text box is laid out. The same attributes are drawn by React (thumbnails, presenting) and read back from the editable box. */
/** the paragraph takes its first run's size, so the bullet or number beside it is as big as the text */
export const paraStyle = (p: Para): CSSProperties => ({ textAlign: p.align ?? 'left', ['--lvl' as string]: p.level ?? 0, fontSize: pxOfPt(p.runs[0]?.size ?? DEFAULT_SIZE), ...(p.lh ? { lineHeight: p.lh } : {}) });
export const runStyle = (r: Run, deckFont: string): CSSProperties => ({
  fontSize: pxOfPt(r.size ?? DEFAULT_SIZE), fontWeight: r.b ? 700 : 400, fontStyle: r.i ? 'italic' : 'normal', textDecoration: r.u ? 'underline' : 'none', color: r.color, fontFamily: fontStack(r.font ?? deckFont),
});

/** Static drawing of a text box's paragraphs. */
export function RichText({ paras, font }: { paras: Para[]; font: string }) {
  return (
    <>
      {paras.map((p, i) => {
        const empty = p.runs.length === 0 || p.runs.every((r) => r.text === '');
        return (
        <div key={i} className="slide-p" data-bullet={p.bullet && !empty ? '1' : undefined} data-num={p.num && !empty ? '1' : undefined} data-lh={p.lh} data-level={p.level ?? 0} data-align={p.align} style={paraStyle(p)}>
          {empty ? <span style={runStyle(p.runs[0] ?? { text: '' }, font)}><br /></span> : p.runs.map((r, j) => (r.text === '\n' ? <br key={j} /> : <span key={j} style={runStyle(r, font)}>{r.text}</span>))}
        </div>
        );
      })}
    </>
  );
}

/** Fill an editable box with the paragraphs (the box is edited as ordinary rich text, then read back with `readParas`). */
export function fillEditable(root: HTMLElement, paras: Para[], font: string): void {
  root.textContent = '';
  for (const p of paras.length ? paras : [{ runs: [] } as Para]) {
    const d = document.createElement('div');
    d.className = 'slide-p';
    if (p.bullet) d.setAttribute('data-bullet', '1');
    if (p.num) d.setAttribute('data-num', '1');
    if (p.lh) { d.setAttribute('data-lh', String(p.lh)); d.style.lineHeight = String(p.lh); }
    d.setAttribute('data-level', String(p.level ?? 0));
    if (p.align) d.setAttribute('data-align', p.align);
    d.style.textAlign = p.align ?? 'left'; d.style.setProperty('--lvl', String(p.level ?? 0)); d.style.fontSize = `${pxOfPt(p.runs[0]?.size ?? DEFAULT_SIZE)}px`;
    const empty = p.runs.length === 0 || p.runs.every((r) => r.text === '');
    if (empty) { const sp = document.createElement('span'); applyRun(sp, p.runs[0] ?? { text: '' }, font); sp.appendChild(document.createElement('br')); d.appendChild(sp); }
    else for (const r of p.runs) {
      if (r.text === '\n') { d.appendChild(document.createElement('br')); continue; }
      const sp = document.createElement('span'); applyRun(sp, r, font); sp.textContent = r.text; d.appendChild(sp);
    }
    root.appendChild(d);
  }
}
function applyRun(el: HTMLElement, r: Run, font: string) {
  const s = runStyle(r, font);
  el.style.fontSize = `${s.fontSize}px`; el.style.fontWeight = String(s.fontWeight); el.style.fontStyle = String(s.fontStyle); el.style.textDecoration = String(s.textDecoration);
  if (s.color) el.style.color = String(s.color);
  el.style.fontFamily = String(s.fontFamily);
}

const rgbToHex = (c: string): string | undefined => { const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c); return m ? `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}` : undefined; };
const FONT_FIRST = (f: string) => f.split(',')[0].replace(/["']/g, '').trim();

/** Read the editable box back into paragraphs and runs. Every text node's look comes from the browser's computed style, so bold made with the toolbar, a shortcut or a paste all count. */
export function readParas(root: HTMLElement, deckFont: string, fallbackSize: number): Para[] {
  const baseColor = getComputedStyle(root).color;
  const blocks = [...root.childNodes].filter((n) => n.nodeType === 1 || (n.nodeType === 3 && (n.textContent ?? '') !== ''));
  const out: Para[] = [];
  let prev: Para | null = null;
  const handle = (block: Node) => {
    const el = block.nodeType === 1 ? (block as HTMLElement) : null;
    const runs: Run[] = [];
    const walk = (n: Node) => {
      if (n.nodeType === 3) {
        const t = (n.textContent ?? '').replace(/​/g, '');
        if (!t) return;
        const pe = n.parentElement ?? root, cs = getComputedStyle(pe);
        const run: Run = { text: t, size: Math.round(parseFloat(cs.fontSize) * 0.75 * 10) / 10 };
        const w = cs.fontWeight; if (w === 'bold' || Number(w) >= 600) run.b = true;
        if (cs.fontStyle === 'italic') run.i = true;
        if ((cs.textDecorationLine || cs.textDecoration).includes('underline')) run.u = true;
        const col = rgbToHex(cs.color); if (col && cs.color !== baseColor) run.color = col;
        const f = FONT_FIRST(cs.fontFamily); if (f && f !== deckFont && !/^(sans-serif|serif|system-ui)$/i.test(f)) run.font = f;
        const last = runs[runs.length - 1];
        if (last && last.text !== '\n' && JSON.stringify({ ...last, text: '' }) === JSON.stringify({ ...run, text: '' })) last.text += t; else runs.push(run);
      } else if (n.nodeType === 1) {
        if ((n as HTMLElement).tagName === 'BR') { if (n.parentNode === el || n.parentNode === root || (n as HTMLElement).nextSibling) runs.push({ text: '\n' }); return; }
        n.childNodes.forEach(walk);
      }
    };
    if (el && el.tagName === 'DIV' || el?.tagName === 'P') el!.childNodes.forEach(walk); else walk(block);
    // a trailing line break only keeps an empty line open
    while (runs.length && runs[runs.length - 1].text === '\n') runs.pop();
    const bulletAttr = el?.getAttribute('data-bullet'), numAttr = el?.getAttribute('data-num'), hasAttrs = el?.hasAttribute('data-level');
    const para: Para = { runs };
    const align = (el?.getAttribute('data-align') ?? (hasAttrs ? undefined : prev?.align)) as Para['align'] | undefined;
    if (align && align !== 'left') para.align = align;
    const bullet = hasAttrs ? bulletAttr === '1' : prev?.bullet;
    const num = hasAttrs ? numAttr === '1' : prev?.num;
    if (bullet || num) { if (bullet) para.bullet = true; else para.num = true; const lvl = hasAttrs ? Number(el!.getAttribute('data-level')) : prev?.level ?? 0; if (lvl) para.level = lvl; }
    const lh = Number(el?.getAttribute('data-lh') ?? (hasAttrs ? 0 : prev?.lh ?? 0)); if (lh) para.lh = lh;
    if (!runs.length) { const sp = el?.querySelector('span'); para.runs = [{ text: '', size: sp ? Math.round(parseFloat(getComputedStyle(sp).fontSize) * 0.75 * 10) / 10 : (prev?.runs[0]?.size ?? fallbackSize) }]; }
    out.push(para); prev = para;
  };
  blocks.forEach(handle);
  return out.length ? out : [{ runs: [{ text: '', size: fallbackSize }] }];
}
