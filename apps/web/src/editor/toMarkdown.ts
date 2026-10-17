import type { Json } from './docxImport.ts';

/**
 * The document as Markdown text, for View > Markdown view. It is a rendering: what Markdown cannot say (colours, fonts, sizes, alignment) is dropped, and
 * saving from that view writes a .md file and never touches the .docx. Pictures become `![alt](embedded image)` so a data URL does not flood the text.
 */
export function toMarkdown(doc: Json): string {
  const esc = (t: string) => t.replace(/([\\`*_[\]])/g, '\\$1');
  const inline = (nodes: Json[] | undefined): string => (nodes ?? []).map((n) => {
    if (n.type === 'hardBreak') return '  \n';
    if (n.type === 'image') return `![${esc(String(n.attrs?.alt ?? 'image'))}](embedded image)`;
    if (n.type !== 'text') return '';
    let t = esc(n.text ?? '');
    const lead = /^\s*/.exec(t)![0], trail = /\s*$/.exec(t)![0];
    let core = t.slice(lead.length, t.length - trail.length);
    if (!core) return t;
    const marks = new Set((n.marks ?? []).map((m) => m.type));
    if (marks.has('bold') && marks.has('italic')) core = `***${core}***`; else if (marks.has('bold')) core = `**${core}**`; else if (marks.has('italic')) core = `*${core}*`;
    if (marks.has('strike')) core = `~~${core}~~`;
    const link = n.marks?.find((m) => m.type === 'link')?.attrs?.href;
    if (typeof link === 'string' && link) core = `[${core}](${link})`;
    t = lead + core + trail;
    return t;
  }).join('');
  const block = (n: Json, depth = 0): string => {
    switch (n.type) {
      case 'heading': return `${'#'.repeat(Math.min(Number(n.attrs?.level) || 1, 6))} ${inline(n.content)}`;
      case 'paragraph': {
        const t = inline(n.content);
        if (n.attrs?.pstyle === 'title') return `# ${t}`;
        if (n.attrs?.pstyle === 'subtitle') return `*${t}*`;
        if (n.attrs?.tab) return `---\n\n**${t}**`;
        return t;
      }
      case 'bulletList': case 'orderedList': {
        const ordered = n.type === 'orderedList';
        return (n.content ?? []).map((li, i) => {
          const [first, ...rest] = li.content ?? [];
          const bullet = `${'  '.repeat(depth)}${ordered ? `${i + 1}.` : '-'} `;
          const head = first ? (first.type === 'paragraph' ? inline(first.content) : block(first, depth + 1)) : '';
          const tail = rest.map((r) => (r.type === 'bulletList' || r.type === 'orderedList' ? block(r, depth + 1) : `${'  '.repeat(depth + 1)}${block(r, depth + 1)}`)).join('\n');
          return bullet + head + (tail ? `\n${tail}` : '');
        }).join('\n');
      }
      case 'blockquote': return (n.content ?? []).map((c) => block(c)).join('\n\n').split('\n').map((l) => `> ${l}`).join('\n');
      case 'horizontalRule': return '---';
      case 'table': {
        const rows = (n.content ?? []).map((r) => (r.content ?? []).map((c) => (c.content ?? []).map((p) => inline(p.content)).join(' ').replace(/\|/g, '\\|')));
        if (!rows.length) return '';
        const cols = Math.max(...rows.map((r) => r.length));
        const pad = (r: string[]) => `| ${Array.from({ length: cols }, (_, i) => r[i] ?? '').join(' | ')} |`;
        return [pad(rows[0]), `|${' --- |'.repeat(cols)}`, ...rows.slice(1).map(pad)].join('\n');
      }
      default: return '';
    }
  };
  return (doc.content ?? []).map((n) => block(n)).filter((s, i, a) => s !== '' || (i > 0 && a[i - 1] !== '')).join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
