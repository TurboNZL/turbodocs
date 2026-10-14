import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { desktop } from '../lib/settings.ts';
import { renderMarkdown } from '../lib/markdown.ts';

type Loaded = { kind: 'docx' | 'md' | 'txt'; bytes: Uint8Array };
const kindOf = (path: string): Loaded['kind'] | null => {
  const ext = /\.[^./\\]+$/.exec(path)?.[0].toLowerCase();
  return ext === '.docx' ? 'docx' : ext === '.md' || ext === '.markdown' ? 'md' : ext === '.txt' ? 'txt' : null;
};
const decode = (b: Uint8Array) => new TextDecoder('utf-8').decode(b);

/**
 * Word draws bullets with private-use characters of the Symbol and Wingdings fonts (U+F0B7 and friends), which exist on Windows and macOS but
 * not on Linux, so they showed as nothing. Map the common ones to real Unicode and let the bullet use the document's own font.
 */
const SYMBOL_BULLETS: Record<string, string> = { '\uF0B7': '\u2022', '\uF0A7': '\u25AA', '\uF0D8': '\u27A2', '\uF0FC': '\u2713', '\uF076': '\u2756', '\uF0A8': '\u25FB', '\uF0E0': '\u2192' };
export function fixSymbolBullets(root: ParentNode) {
  for (const st of root.querySelectorAll('style')) {
    const css = st.textContent ?? '';
    if (!/[\uF000-\uF0FF]/.test(css)) continue;
    st.textContent = css.replace(/[\uF000-\uF0FF]/g, (c) => SYMBOL_BULLETS[c] ?? '\u2022').replace(/font-family:\s*(?:Symbol|Wingdings\s*\d?)\s*;/gi, 'font-family: inherit;');
  }
}

/** The Docs module's viewer: .docx rendered by docx-preview (read-only), Markdown by our own safe renderer, text as it is. */
export function ViewPage() {
  const [params] = useSearchParams();
  const path = params.get('path') ?? '';
  const name = path.split(/[\\/]/).pop() ?? path;
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);   // md
  const [text, setText] = useState<string | null>(null);   // txt
  const [busy, setBusy] = useState(true);
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setError(null); setHtml(null); setText(null); setBusy(true);
    host.current?.replaceChildren(); // nothing of the previous file may linger
    (async () => {
      const d = desktop();
      const kind = kindOf(path);
      if (!d) throw new Error('Files open in the desktop app.');
      if (!kind) throw new Error('The Docs module does not open this type of file.');
      const bytes = await d.readFile(path);
      if (!alive) return;
      const file: Loaded = { kind, bytes };
      if (kind === 'md') setHtml(renderMarkdown(decode(bytes)));
      else if (kind === 'txt') setText(decode(bytes));
      else {
        const { renderAsync } = await import('docx-preview'); // only loaded when a .docx is opened
        if (!alive || !host.current) return;
        // pageless: no page breaks, no fixed page width, so the text fills the window like the old app's canvas
        await renderAsync(file.bytes, host.current, undefined, { className: 'docx', inWrapper: false, breakPages: false, ignoreWidth: true, ignoreHeight: true, ignoreLastRenderedPageBreak: true, renderHeaders: false, renderFooters: false });
        fixSymbolBullets(host.current);
      }
    })().catch((e: Error) => { if (alive) setError(e.message); }).finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [path]);

  // links in a document: only http(s) is followed (the main process opens it in the browser); anything else is ignored
  const onClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a');
    if (!a) return;
    const href = a.getAttribute('href') ?? '';
    if (!/^https?:/i.test(href)) { e.preventDefault(); return; }
    e.preventDefault();
    window.open(href, '_blank');
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="flex items-center gap-3">
        <Link to="/" className="btn btn-ghost inline-flex items-center gap-1" aria-label="Back to Home"><ArrowLeft size={16} />Home</Link>
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold" title={path}>{name}</h1>
      </div>
      {error && <div className="rounded-theme bg-bad/15 p-3 text-sm text-bad">{error}</div>}
      {busy && !error && <div className="text-sm text-muted">Loading…</div>}
      {html !== null && <article className="guide card p-6" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />}
      {text !== null && <pre className="card whitespace-pre-wrap break-words p-6 font-mono text-sm">{text}</pre>}
      {/* a Word document keeps its own colours (usually dark text for a white page), so it sits on a white sheet whatever the theme */}
      <div ref={host} onClick={onClick} className="docx-sheet rounded-theme bg-white p-8 text-black" hidden={!!error || kindOf(path) !== 'docx'} />
    </div>
  );
}
