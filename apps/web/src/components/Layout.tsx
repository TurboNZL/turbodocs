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
import { usePref } from '../lib/pref.ts';

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
  const [layout] = usePref('ui.layout', 'side');
  const [focus] = usePref('ui.focusEditing', 'on');
  const hideNav = focus === 'on' && pathname.startsWith('/edit'); // a document gets the whole window; its header has the way back
  const link = (n: (typeof NAV)[number], showLabel: boolean) => (
    <NavLink key={n.to} to={n.to} end={n.end} title={n.label} aria-label={n.label} onClick={(e) => { if (!confirmLeave()) e.preventDefault(); }} className={({ isActive }) => cn('bt-nav flex items-center gap-2 px-3 py-2 text-sm', isActive && 'font-medium')}>
      {({ isActive }) => <span className="flex items-center gap-2" aria-current={isActive ? 'page' : undefined}><n.icon size={16} />{showLabel && n.label}</span>}
    </NavLink>
  );
  return (
    <div className="flex h-full flex-col bg-bg text-fg">
      <WindowFrame />
      {!hideNav && layout === 'top' && (
        <nav aria-label="Main" className="bt-top flex items-center gap-1 px-3 py-1.5"><span className="mr-3 text-base font-bold">TurboDocs</span>{NAV.map((n) => link(n, true))}</nav>
      )}
      <div className="flex min-h-0 flex-1">
        {!hideNav && layout !== 'top' && (
          <nav aria-label="Main" className={cn('bt-side flex shrink-0 flex-col gap-1 p-3', layout === 'rail' ? 'w-16 items-center !px-2' : 'w-52')}>
            {layout === 'rail' ? <div className="pb-3 pt-1 text-lg font-bold" title="TurboDocs">T</div> : <div className="px-2 pb-3 pt-1 text-lg font-bold">TurboDocs</div>}
            {NAV.map((n) => link(n, layout !== 'rail'))}
          </nav>
        )}
        <main key={pathname} className="bt-page tk-swap min-w-0 flex-1 overflow-y-auto"><Outlet /></main>
      </div>
    </div>
  );
}
