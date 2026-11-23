import { useEffect, useState } from 'react';
import type { Units } from './format';

/** Imagery used by the map: Google tiles, or the default Leaflet tiles (OpenStreetMap + Esri). */
export type MapImagery = 'google' | 'default';

/** Color theme of the whole app, map included. `system` follows the OS setting. */
export type Theme = 'light' | 'dark' | 'system';

export interface MapSettings {
  imagery: MapImagery;
  /** Distances and speeds in km / km/h (metric) or miles / mph (imperial). */
  units: Units;
  theme: Theme;
}

/** Default imagery: true → Google tiles, false → default Leaflet tiles (OSM + Esri). */
export const USE_GOOGLE_MAP = true;

export const DEFAULT_SETTINGS: MapSettings = {
  imagery: USE_GOOGLE_MAP ? 'google' : 'default',
  units: 'metric',
  theme: 'light',
};

const KEY = 'route-distance:map-settings';

export function loadSettings(): MapSettings {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    // `tiles` is the key used by an earlier version of these settings.
    const imagery = s.imagery ?? s.tiles;
    return {
      imagery: imagery === 'google' || imagery === 'default' ? imagery : DEFAULT_SETTINGS.imagery,
      units: s.units === 'imperial' ? 'imperial' : 'metric',
      theme: s.theme === 'dark' || s.theme === 'system' ? s.theme : DEFAULT_SETTINGS.theme,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function persistSettings(s: MapSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}

const darkQuery = () => matchMedia('(prefers-color-scheme: dark)');

export const resolveDark = (theme: Theme) => theme === 'dark' || (theme === 'system' && darkQuery().matches);

/** Whether the app is dark right now; follows the OS while the theme is `system`. */
export function useDark(theme: Theme): boolean {
  const [systemDark, setSystemDark] = useState(() => darkQuery().matches);
  useEffect(() => {
    if (theme !== 'system') return;
    const q = darkQuery();
    const on = () => setSystemDark(q.matches);
    on();
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, [theme]);
  return theme === 'dark' || (theme === 'system' && systemDark);
}

/** Set the page theme (`data-theme` on <html>); `animate` fades colors instead of snapping. */
export function applyTheme(dark: boolean, animate = false) {
  const root = document.documentElement;
  // Browser UI color (mobile address bar, installed app title bar) follows the theme too.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#202124' : '#1a73e8');
  if (root.dataset.theme === (dark ? 'dark' : 'light')) return;
  if (animate) {
    root.classList.add('theme-anim');
    window.setTimeout(() => root.classList.remove('theme-anim'), 300);
  }
  root.dataset.theme = dark ? 'dark' : 'light';
}
