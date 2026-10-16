import { describe, expect, it } from 'vitest';
import { shortFolder, timeAgo } from '../src/lib/timeAgo.ts';

describe('timeAgo', () => {
  const now = 1_000_000_000_000;
  it('speaks like the first TurboDocs', () => {
    expect(timeAgo(now - 10_000, now)).toBe('just now');
    expect(timeAgo(now - 32 * 60_000, now)).toBe('32 min ago');
    expect(timeAgo(now - 3600_000, now)).toBe('1 hour ago');
    expect(timeAgo(now - 5 * 3600_000, now)).toBe('5 hours ago');
    expect(timeAgo(now - 3 * 86400_000, now)).toBe('3 days ago');
    expect(timeAgo(now - 90 * 86400_000, now)).toBe('3 months ago');
  });
  it('never shows a future time as negative', () => { expect(timeAgo(now + 5000, now)).toBe('just now'); });
});
describe('shortFolder', () => {
  it('keeps short folders and shortens the middle of long ones', () => {
    expect(shortFolder('/home/me/a.docx')).toBe('/home/me');
    const long = shortFolder('/home/someone/Documents/projects/quarterly/reports/2026/final/a.docx', 30);
    expect(long.length).toBeLessThanOrEqual(30);
    expect(long).toContain('…');
  });
});
