import { startAppearance } from './lib/appearance.ts'; // first: the saved look is applied before anything paints
import './fonts.css';
import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.tsx';
import { startFontDetection } from './lib/fontList.ts';
import { applyMotionPref } from './lib/docPrefs.ts';

startAppearance();
void startFontDetection();
applyMotionPref();
createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter><App /></BrowserRouter></StrictMode>);
