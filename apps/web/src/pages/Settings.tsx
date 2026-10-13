import { useSearchParams } from 'react-router-dom';
import { AppearancePicker } from '../components/AppearancePicker.tsx';
import { AppsTab } from '../components/AppsTab.tsx';
import { GuidesTab } from '../components/GuidesTab.tsx';
import { ThisApp } from '../components/ThisApp.tsx';

const TABS = [{ id: 'look', label: 'Appearance' }, { id: 'apps', label: 'Apps' }, { id: 'guides', label: 'Guides' }, { id: 'app', label: 'This app' }];

export function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab')! : 'look';
  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <div role="tablist" aria-label="Settings sections" className="tabs">
        {TABS.map((t) => <button key={t.id} role="tab" className="tab" aria-selected={tab === t.id} onClick={() => setParams({ tab: t.id }, { replace: true })}>{t.label}</button>)}
      </div>
      {tab === 'look' && <AppearancePicker />}
      {tab === 'apps' && <AppsTab />}
      {tab === 'guides' && <GuidesTab />}
      {tab === 'app' && <ThisApp />}
    </div>
  );
}
