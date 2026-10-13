import { describe, expect, it } from 'vitest';
import { filesFromArgv, isInstalled, MODULES, moduleFor } from '../src/modules.ts';

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
