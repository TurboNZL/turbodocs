import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout.tsx';
import { HomePage } from './pages/Home.tsx';
import { SettingsPage } from './pages/Settings.tsx';
import { ViewPage } from './pages/View.tsx';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="view" element={<ViewPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
