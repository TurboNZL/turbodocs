import { readFile, stat } from 'node:fs/promises';
import { extname } from 'node:path';
import JSZip from 'jszip';

/** The recent-documents list of the first TurboDocs' dashboard: newest first, each file once, at most 10. */
export interface Recent { path: string; at: number }
export const RECENT_MAX = 10;

export function pushRecent(list: Recent[], path: string, at: number, max = RECENT_MAX): Recent[] {
  return [{ path, at }, ...list.filter((r) => r.path !== path)].slice(0, max);
}

const clip = (t: string, n = 160) => { const s = t.replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s; };
const unescapeXml = (t: string) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** The first words of a Word document, from the text runs of word/document.xml (paragraphs are separated by a space). */
export function snippetFromDocxXml(xml: string): string {
  const paras = xml.split(/<\/w:p>/);
  const out: string[] = [];
  for (const p of paras) {
    const t = [...p.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
    if (t.trim()) out.push(unescapeXml(t));
    if (out.join(' ').length > 200) break;
  }
  return clip(out.join(' '));
}
/** A presentation: the text of its first slide, from the `a:t` runs of ppt/slides/slide1.xml. */
export function snippetFromPptxXml(xml: string): string {
  const t = [...xml.matchAll(/<a:t(?: [^>]*)?>([^<]*)<\/a:t>/g)].map((m) => unescapeXml(m[1])).filter((x) => x.trim());
  return clip(t.join(' · '));
}
/** A workbook: its first texts, from xl/sharedStrings.xml (numbers are not listed there; a workbook of numbers only has no preview). */
export function snippetFromSharedStrings(xml: string): string {
  const out: string[] = [];
  for (const si of xml.split('</si>')) {
    const t = [...si.matchAll(/<t(?: [^>]*)?>([^<]*)<\/t>/g)].map((m) => m[1]).join('');
    if (t.trim()) out.push(unescapeXml(t));
    if (out.join(' · ').length > 200) break;
  }
  return clip(out.join(' · '));
}
export const snippetFromText = (t: string) => clip(t.slice(0, 2000));

/** What a recent file looks like on its card; '' when it cannot be read (a card then shows no preview). */
export async function snippetOf(path: string): Promise<string> {
  try {
    const ext = extname(path).toLowerCase();
    if (ext === '.docx') {
      const xml = await (await JSZip.loadAsync(await readFile(path))).file('word/document.xml')?.async('string');
      return xml ? snippetFromDocxXml(xml) : '';
    }
    if (ext === '.pptx') {
      const xml = await (await JSZip.loadAsync(await readFile(path))).file('ppt/slides/slide1.xml')?.async('string');
      return xml ? snippetFromPptxXml(xml) : '';
    }
    if (ext === '.xlsx') {
      const xml = await (await JSZip.loadAsync(await readFile(path))).file('xl/sharedStrings.xml')?.async('string');
      return xml ? snippetFromSharedStrings(xml) : '';
    }
    const buf = await readFile(path);
    return snippetFromText(buf.subarray(0, 4000).toString('utf8'));
  } catch { return ''; }
}

export const existingFile = (path: string) => stat(path).then((s) => s.isFile(), () => false);
