/** "just now", "32 min ago", "3 days ago": the first TurboDocs' recent cards. `now` is a parameter so it can be tested. */
export function timeAgo(then: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} ${d === 1 ? 'day' : 'days'} ago`;
  const mo = Math.round(d / 30);
  return mo < 12 ? `${mo} ${mo === 1 ? 'month' : 'months'} ago` : `${Math.round(mo / 12)} ${Math.round(mo / 12) === 1 ? 'year' : 'years'} ago`;
}

/** Folder of a path, middle shortened ("/home/me/…/reports") so it fits a card. */
export function shortFolder(path: string, max = 46): string {
  const dir = path.replace(/[\\/][^\\/]*$/, '');
  if (dir.length <= max) return dir;
  const keep = Math.floor((max - 1) / 2);
  return `${dir.slice(0, keep)}…${dir.slice(dir.length - keep)}`;
}
