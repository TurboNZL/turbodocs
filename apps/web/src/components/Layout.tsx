import { NavLink, Outlet } from 'react-router-dom';
import { Home, Settings } from 'lucide-react';
import { WindowFrame } from './WindowFrame.tsx';
import { cn } from '../lib/cn.ts';

const NAV = [{ to: '/', label: 'Home', icon: Home, end: true }, { to: '/settings', label: 'Settings', icon: Settings, end: false }];

/** Window frame, a side bar (the themes' `.bt-side` / `.bt-nav`) and the page area (`.bt-page` animates on a page change). */
export function Layout() {
  return (
    <div className="flex h-full flex-col bg-bg text-fg">
      <WindowFrame />
      <div className="flex min-h-0 flex-1">
        <nav aria-label="Main" className="bt-side flex w-52 shrink-0 flex-col gap-1 p-3">
          <div className="px-2 pb-3 pt-1 text-lg font-bold">TurboDocs</div>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn('bt-nav flex items-center gap-2 px-3 py-2 text-sm', isActive && 'font-medium')} aria-current={undefined}>
              {({ isActive }) => <span className="flex items-center gap-2" aria-current={isActive ? 'page' : undefined}><n.icon size={16} />{n.label}</span>}
            </NavLink>
          ))}
        </nav>
        <main className="bt-page min-w-0 flex-1 overflow-y-auto p-6"><Outlet /></main>
      </div>
    </div>
  );
}
