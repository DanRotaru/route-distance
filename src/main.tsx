import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initAnalytics } from './analytics';
import { applyTheme, loadSettings, resolveDark } from './settings';
import './styles.css';

// Before the first render, so a dark theme doesn't flash white.
applyTheme(resolveDark(loadSettings().theme));
initAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
