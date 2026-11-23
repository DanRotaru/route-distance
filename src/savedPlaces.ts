import type { LatLon, Place } from './types';

export type SavedKind = 'home' | 'work' | 'custom';

/** A place the user saved under a name ("Home", "Work", "Gym", ...). Home/Work always exist, unset until chosen. */
export interface SavedPlace {
  id: string;
  kind: SavedKind;
  name: string;
  point: LatLon | null;
  /** Address resolved when the point was chosen, shown as secondary text. */
  address?: string;
}

const KEY = 'route-distance:saved-places';

const builtIn = (): SavedPlace[] => [
  { id: 'home', kind: 'home', name: 'Home', point: null },
  { id: 'work', kind: 'work', name: 'Work', point: null },
];

function validPoint(p: unknown): p is LatLon {
  const o = p as LatLon | null;
  return !!o && Number.isFinite(o.lat) && Number.isFinite(o.lon);
}

export function loadSavedPlaces(): SavedPlace[] {
  const list = builtIn();
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(stored)) return list;
    for (const s of stored as Partial<SavedPlace>[]) {
      const point = validPoint(s.point) ? { lat: s.point.lat, lon: s.point.lon } : null;
      const address = typeof s.address === 'string' ? s.address : undefined;
      const fixed = list.find((b) => b.id === s.id && b.kind !== 'custom');
      if (fixed) Object.assign(fixed, { point, address });
      else if (s.kind === 'custom' && typeof s.id === 'string' && typeof s.name === 'string' && s.name.trim() && point)
        list.push({ id: s.id, kind: 'custom', name: s.name.trim(), point, address });
    }
  } catch {
    /* storage unavailable or corrupt */
  }
  return list;
}

export function persistSavedPlaces(list: SavedPlace[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
}

export const newSavedId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const normName = (s: string) => s.trim().toLocaleLowerCase();

/** Saved places (with a location) whose name matches the typed text, best matches first. */
export function matchSaved(list: SavedPlace[], text: string): SavedPlace[] {
  const q = normName(text);
  const set = list.filter((s) => s.point);
  if (!q) return set;
  const score = (s: SavedPlace) => {
    const n = normName(s.name);
    return n === q ? 0 : n.startsWith(q) ? 1 : n.includes(q) ? 2 : -1;
  };
  return set
    .map((s) => ({ s, k: score(s) }))
    .filter((x) => x.k >= 0)
    .sort((a, b) => a.k - b.k)
    .map((x) => x.s);
}

/** The saved place whose name is exactly the typed text (case-insensitive), if it has a location. */
export const exactSaved = (list: SavedPlace[], text: string) =>
  list.find((s) => s.point && normName(s.name) === normName(text));

export const savedToPlace = (s: SavedPlace): Place => ({
  ...s.point!,
  label: s.name,
  name: s.name,
  detail: s.address,
});
