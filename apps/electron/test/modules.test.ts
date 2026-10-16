import { describe, expect, it } from 'vitest';
import { argToPath, filesFromArgv, isInstalled, MIME_TYPES, mimeRows, MODULES, moduleFor } from '../src/modules.ts';
import { parseDefault } from '../src/defaultApps.ts';

describe('which module opens a file', () => {
  it('goes by the extension, case-insensitively', () => {
    expect(moduleFor('/home/a/Report.DOCX')?.id).toBe('docs');
    expect(moduleFor('notes.md')?.id).toBe('docs');
    expect(moduleFor('C:\\data\\book.xlsx')?.id).toBe('sheets');
    expect(moduleFor('deck.pptx')?.id).toBe('slides');
    expect(moduleFor('archive.zip')).toBeUndefined();
    expect(moduleFor('no-extension')).toBeUndefined();
  });
  it('every extension belongs to exactly one module', () => {
    const all = MODULES.flatMap((m) => m.extensions);
    expect(new Set(all).size).toBe(all.length);
    expect(all.every((e) => e === e.toLowerCase() && e.startsWith('.'))).toBe(true);
  });
});

describe('installed modules', () => {
  const docs = MODULES.find((m) => m.id === 'docs')!;
  const sheets = MODULES.find((m) => m.id === 'sheets')!;
  it('Docs is installed by default; a module without code can never be installed', () => {
    expect(isInstalled(docs, {})).toBe(true);
    expect(isInstalled(docs, { docs: false })).toBe(false);
    expect(sheets.available).toBe(false);
    expect(isInstalled(sheets, { sheets: true })).toBe(false);
  });
});

describe('files named on the command line', () => {
  it('skips the program, the app path and flags, and keeps only files a module opens', () => {
    expect(filesFromArgv(['electron', '.', '--no-sandbox', '/tmp/a.docx', '/tmp/b.zip', '--user-data-dir=/x', 'c.md'], false)).toEqual(['/tmp/a.docx', 'c.md']);
    expect(filesFromArgv(['/usr/bin/turbodocs', '/tmp/a.docx'], true)).toEqual(['/tmp/a.docx']);
    expect(filesFromArgv(['/usr/bin/turbodocs'], true)).toEqual([]);
  });
});

describe('launcher arguments (the desktop file passes %U)', () => {
  it('turns file:// URLs into paths, decoding them', () => {
    expect(argToPath('file:///home/a/My%20doc.docx')).toBe('/home/a/My doc.docx');
    expect(argToPath('file:///home/a/%C3%9Cn%C3%AFc%C3%B6d%C3%A9.md')).toBe('/home/a/Ünïcödé.md');
    expect(argToPath('/plain/path.docx')).toBe('/plain/path.docx');
  });
  it('ignores flags and other URLs', () => {
    expect(argToPath('--no-sandbox')).toBeNull();
    expect(argToPath('https://example.com/a.docx')).toBeNull();
    expect(argToPath('file://%zz')).toBeNull();
  });
  it('filesFromArgv accepts a mix of both forms', () => {
    expect(filesFromArgv(['/opt/TurboDocs/turbodocs', 'file:///tmp/a%20b.docx', '/tmp/c.txt', 'https://x/y.docx', '--flag'], true)).toEqual(['/tmp/a b.docx', '/tmp/c.txt']);
  });
});

describe('default applications', () => {
  it('every extension a module opens has a MIME type, and .md and .markdown share one row', () => {
    for (const m of MODULES) for (const e of m.extensions) expect(MIME_TYPES[e], e).toBeTruthy();
    const docs = mimeRows(MODULES.filter((m) => m.id === 'docs'));
    expect(docs.map((r) => r.mime)).toEqual(['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/markdown', 'text/plain']);
  });
  it('reads the desktop file name from xdg-mime output', () => {
    expect(parseDefault('turbodocs.desktop\n')).toBe('turbodocs.desktop');
    expect(parseDefault('')).toBe('');
  });
});
