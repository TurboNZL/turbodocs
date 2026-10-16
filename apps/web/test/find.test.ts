import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { editorExtensions } from '../src/editor/extensions.ts';
import { searchKey } from '../src/editor/search.ts';
import { findInString, replaceAllInString, searchRegex } from '../src/editor/find.ts';

const o = (query: string, caseSensitive = false, regex = false) => ({ query, caseSensitive, regex });

describe('find in a string', () => {
  it('finds every match, ignoring case unless asked', () => {
    expect(findInString('Car car CAR', o('car'))).toHaveLength(3);
    expect(findInString('Car car CAR', o('car', true))).toEqual([{ from: 4, to: 7 }]);
  });
  it('treats the query literally unless it is a regular expression', () => {
    expect(findInString('a.b axb', o('a.b'))).toHaveLength(1);
    expect(findInString('a.b axb', o('a.b', false, true))).toHaveLength(2);
  });
  it('survives an invalid regex and an empty-matching one', () => {
    expect(searchRegex(o('(', false, true))).toBeNull();
    expect(findInString('abc', o('(', false, true))).toEqual([]);
    expect(findInString('bbb', o('a*', false, true))).toEqual([]);
  });
  it('replaces all, expanding $1 in regex mode', () => {
    expect(replaceAllInString('one two one', o('one'), '1')).toEqual({ text: '1 two 1', count: 2 });
    expect(replaceAllInString('Lambo Ferrari', o('(\\w+) (\\w+)', false, true), '$2 $1').text).toBe('Ferrari Lambo');
  });
});

describe('find and replace in the Word editor', () => {
  const make = () => new Editor({ extensions: editorExtensions, content: { type: 'doc', content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Lambo ' }, { type: 'text', text: 'Murcielago', marks: [{ type: 'bold' }] }, { type: 'text', text: ' and a Lambo' }] },
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'lambo in a list' }] }] }] },
    { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'LAMBO cell' }] }] }] }] },
  ] } });
  it('finds across formatting, lists and tables, and steps through the matches', () => {
    const e = make();
    e.commands.setSearch(o('lambo'));
    expect(searchKey.getState(e.state)!.matches).toHaveLength(4);
    e.commands.findStep(1);
    expect(searchKey.getState(e.state)!.current).toBe(1);
    e.commands.findStep(-1); e.commands.findStep(-1);
    expect(searchKey.getState(e.state)!.current).toBe(3); // wraps round
    e.destroy();
  });
  it('finds text split by a bold run', () => {
    const e = make();
    e.commands.setSearch(o('o Murcielago an'));
    expect(searchKey.getState(e.state)!.matches).toHaveLength(1);
    e.destroy();
  });
  it('replaces one and all, keeping the bold of what it did not touch', () => {
    const e = make();
    e.commands.setSearch(o('lambo'));
    e.commands.replaceCurrent('Ferrari');
    expect(e.state.doc.textContent).toContain('Ferrari Murcielago');
    expect(searchKey.getState(e.state)!.matches).toHaveLength(3);
    e.commands.replaceAll('Tesla');
    expect(searchKey.getState(e.state)!.matches).toHaveLength(0);
    expect(e.state.doc.textContent.match(/Tesla/g)).toHaveLength(3);
    expect(e.getJSON().content![0].content!.some((n) => n.text === 'Murcielago' && n.marks?.some((m) => m.type === 'bold'))).toBe(true);
    e.destroy();
  });
});
