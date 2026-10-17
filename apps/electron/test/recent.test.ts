import { describe, expect, it } from 'vitest';
import { pushRecent, snippetFromDocxXml, snippetFromPptxXml, snippetFromSharedStrings, snippetFromText } from '../src/recent.ts';

describe('recent documents list', () => {
  it('puts the newest first, keeps each file once, and caps the length', () => {
    let l = pushRecent([], '/a.docx', 1);
    l = pushRecent(l, '/b.md', 2);
    l = pushRecent(l, '/a.docx', 3);
    expect(l.map((r) => r.path)).toEqual(['/a.docx', '/b.md']);
    expect(l[0].at).toBe(3);
    for (let i = 0; i < 20; i++) l = pushRecent(l, `/f${i}.txt`, 10 + i);
    expect(l).toHaveLength(10);
    expect(l[0].path).toBe('/f19.txt');
  });
});

describe('card previews', () => {
  it('reads the first words of a Word document', () => {
    const xml = '<w:body><w:p><w:r><w:t>Lambo</w:t></w:r><w:r><w:t xml:space="preserve"> Murcielago</w:t></w:r></w:p><w:p><w:r><w:t>Ferrari &amp; Co</w:t></w:r></w:p></w:body>';
    expect(snippetFromDocxXml(xml)).toBe('Lambo Murcielago Ferrari & Co');
  });
  it('shortens long text with an ellipsis and collapses whitespace', () => {
    const s = snippetFromText(`${'word '.repeat(100)}`);
    expect(s.length).toBeLessThanOrEqual(160);
    expect(s.endsWith('…')).toBe(true);
    expect(snippetFromText('a\n\n  b\tc')).toBe('a b c');
  });
});

describe('previews of spreadsheets and presentations', () => {
  it('lists the first slide\'s text', () => {
    expect(snippetFromPptxXml('<p:sld><a:t>Quarterly &amp; review</a:t><a:t> </a:t><a:t lang="en">Plans</a:t></p:sld>')).toBe('Quarterly & review · Plans');
  });
  it('lists the first texts of a workbook', () => {
    expect(snippetFromSharedStrings('<sst><si><t>Item</t></si><si><r><t>Cof</t></r><r><t>fee</t></r></si><si><t xml:space="preserve"> </t></si></sst>')).toBe('Item · Coffee');
  });
});
