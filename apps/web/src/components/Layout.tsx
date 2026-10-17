import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, Settings } from 'lucide-react';
import { WindowFrame } from './WindowFrame.tsx';
import { cn } from '../lib/cn.ts';
import { desktop, type OpenRequest } from '../lib/settings.ts';
import { addOpened, editUrl } from '../lib/opened.ts';
import { confirmLeave } from '../lib/dirty.ts';
import { goHome, goNew, openFileDialog } from '../lib/actions.ts';
import { docPrefs, lastFile } from '../lib/docPrefs.ts';

const NAV = [{ to: '/', label: 'Home', icon: Home, end: true }, { to: '/settings', label: 'Settings', icon: Settings, end: false }];

/** Window frame, a side bar (the themes' `.bt-side` / `.bt-nav`) and the page area (`.bt-page` animates on a page change). */
export function Layout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // a file arrives from Open, the command line or the system: show it in its module when that is installed, otherwise Home says what is missing
  useEffect(() => {
    const d = desktop();
    if (!d) return;
    const take = (r: OpenRequest) => { addOpened(r); if (!confirmLeave()) return; navigate(r.module && r.installed ? editUrl(r.path) : '/'); };
    void d.takePending().then((rs) => {
      rs.forEach(take);
      // Settings > Documents > "Reopen the last document on startup"
      const last = lastFile();
      if (!rs.length && docPrefs().reopenLast && last && window.location.pathname === '/') void d.openRecent(last).then((r) => take(r)).catch(() => undefined);
    });
    return d.onOpen(take);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // shortcuts of the first TurboDocs that work on every page
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'o' && !e.shiftKey && !e.altKey) { e.preventDefault(); openFileDialog(navigate); }
      else if (k === 'n' && !e.shiftKey && !e.altKey) { e.preventDefault(); goNew(navigate, 'docx'); }
      else if (k === 'h' && e.altKey) { e.preventDefault(); goHome(navigate); }
      else if (k === 'q' && !e.shiftKey && !e.altKey) { e.preventDefault(); desktop()?.windowControl?.('close'); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [navigate]);
  return (
    <div className="flex h-full flex-col bg-bg text-fg">
      <WindowFrame />
      <div className="flex min-h-0 flex-1">
        <nav aria-label="Main" className="bt-side flex w-52 shrink-0 flex-col gap-1 p-3">
          <div className="px-2 pb-3 pt-1 text-lg font-bold">TurboDocs</div>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} onClick={(e) => { if (!confirmLeave()) e.preventDefault(); }} className={({ isActive }) => cn('bt-nav flex items-center gap-2 px-3 py-2 text-sm', isActive && 'font-medium')} aria-current={undefined}>
              {({ isActive }) => <span className="flex items-center gap-2" aria-current={isActive ? 'page' : undefined}><n.icon size={16} />{n.label}</span>}
            </NavLink>
          ))}
        </nav>
        <main key={pathname} className="bt-page tk-swap min-w-0 flex-1 overflow-y-auto"><Outlet /></main>
      </div>
    </div>
  );
}
