import { defaultSpeeds, isModeId, MODES, type ModeId } from './modes';
import type { CalcMode, Place, Waypoint } from './types';

const SPEEDS_KEY = 'route-distance:speeds';
const MODE_KEY = 'route-distance:mode';

let nextId = 1;
export const newWaypoint = (place: Place | null = null): Waypoint => ({
  id: `w${nextId++}`,
  text: place?.label ?? '',
  place,
});

export interface InitialState {
  waypoints: Waypoint[];
  modeId: ModeId;
  speeds: Record<ModeId, number>;
  calc: CalcMode;
  targetMin: number;
}

function parseWaypointParam(v: string): Place | null {
  const [lat, lon, ...rest] = v.split(',');
  const p = { lat: Number(lat), lon: Number(lon) };
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return null;
  return { ...p, label: rest.join(',') || `${p.lat}, ${p.lon}` };
}

export function loadInitialState(): InitialState {
  const speeds = defaultSpeeds();
  let modeId: ModeId = 'car';
  try {
    const stored = JSON.parse(localStorage.getItem(SPEEDS_KEY) || '{}');
    for (const m of MODES) if (typeof stored[m.id] === 'number' && stored[m.id] > 0) speeds[m.id] = stored[m.id];
    const storedMode = localStorage.getItem(MODE_KEY);
    if (isModeId(storedMode)) modeId = storedMode;
  } catch {
    /* storage unavailable */
  }

  const params = new URLSearchParams(location.hash.slice(1));
  const waypoints = params
    .getAll('w')
    .map(parseWaypointParam)
    .filter((p): p is Place => !!p)
    .map((p) => newWaypoint(p));
  while (waypoints.length < 2) waypoints.push(newWaypoint());

  const m = params.get('m');
  if (isModeId(m)) modeId = m;
  const s = Number(params.get('s'));
  if (s > 0) speeds[modeId] = s;
  const t = Number(params.get('t'));

  return { waypoints, modeId, speeds, calc: t > 0 ? 'time' : 'speed', targetMin: t > 0 ? t : 15 };
}

export function persistPrefs(modeId: ModeId, speeds: Record<ModeId, number>) {
  try {
    localStorage.setItem(SPEEDS_KEY, JSON.stringify(speeds));
    localStorage.setItem(MODE_KEY, modeId);
  } catch {
    /* storage unavailable */
  }
}

export function writeHash(waypoints: Waypoint[], modeId: ModeId, speed: number, calc: CalcMode, targetMin: number) {
  const p = new URLSearchParams();
  for (const w of waypoints) {
    if (w.place) p.append('w', `${w.place.lat.toFixed(5)},${w.place.lon.toFixed(5)},${w.place.label}`);
  }
  p.set('m', modeId);
  p.set('s', String(speed));
  if (calc === 'time') p.set('t', String(targetMin));
  history.replaceState(null, '', `#${p}`);
}
