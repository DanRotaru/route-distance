import type { Step } from './types';

/** Seconds needed to cover `meters` at an average of `kmh`. */
export const travelSeconds = (meters: number, kmh: number) => meters / (kmh / 3.6);

/** Average km/h needed to cover `meters` in `seconds`. */
export const requiredSpeed = (meters: number, seconds: number) => (meters / seconds) * 3.6;

export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec)) return '—';
  const totalMin = Math.max(1, Math.round(sec / 60));
  if (totalMin < 60) return `${totalMin} min`;
  const days = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (days > 0) return h ? `${days} d ${h} h` : `${days} d`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Like formatDuration but shows seconds for short legs (turn-by-turn steps). */
export function formatShortDuration(sec: number): string {
  if (sec < 55) return `${Math.max(1, Math.round(sec / 5) * 5)} s`;
  return formatDuration(sec);
}

// ---- units ----
// Everything is computed in meters and km/h; only what is shown converts to the user's unit system.

export type Units = 'metric' | 'imperial';

const KM_PER_MI = 1.609344;
const M_PER_FT = 0.3048;

export const speedUnit = (u: Units) => (u === 'imperial' ? 'mph' : 'km/h');

/** km/h → the speed shown to the user (km/h or mph). */
export const toDisplaySpeed = (kmh: number, u: Units) => (u === 'imperial' ? kmh / KM_PER_MI : kmh);

/** A speed the user entered (km/h or mph) → km/h. */
export const fromDisplaySpeed = (v: number, u: Units) => (u === 'imperial' ? v * KM_PER_MI : v);

export function formatDistance(m: number, u: Units = 'metric'): string {
  if (u === 'imperial') {
    const mi = m / 1000 / KM_PER_MI;
    if (mi < 0.1) {
      const ft = m / M_PER_FT;
      return `${ft < 50 ? Math.round(ft) : Math.round(ft / 10) * 10} ft`;
    }
    return mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`;
  }
  if (m < 950) return `${m < 10 ? Math.round(m) : Math.round(m / 10) * 10} m`;
  const km = m / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/** Number only, in the user's unit (see `formatSpeedUnit` for the unit too). */
export function formatSpeed(kmh: number, u: Units = 'metric'): string {
  if (!Number.isFinite(kmh)) return '—';
  const v = toDisplaySpeed(kmh, u);
  return v < 10 ? String(Math.round(v * 10) / 10) : String(Math.round(v));
}

export const formatSpeedUnit = (kmh: number, u: Units) => `${formatSpeed(kmh, u)} ${speedUnit(u)}`;

/** Minutes per km (or per mile). */
export function formatPace(kmh: number, u: Units = 'metric'): string {
  const minPer = 60 / toDisplaySpeed(kmh, u);
  let m = Math.floor(minPer);
  let s = Math.round((minPer - m) * 60);
  if (s === 60) {
    m += 1;
    s = 0;
  }
  return `${m}:${String(s).padStart(2, '0')} /${u === 'imperial' ? 'mi' : 'km'}`;
}

export const formatClock = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Round a speed to 0.1 in the user's unit, returned in km/h (so e.g. "Use 31.2 mph" stores exactly 31.2 mph). */
export const roundSpeed = (kmh: number, u: Units = 'metric') =>
  fromDisplaySpeed(Math.round(toDisplaySpeed(kmh, u) * 10) / 10, u);

const DIRS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const MODIFIER_TEXT: Record<string, string> = {
  'slight right': 'slightly right',
  'slight left': 'slightly left',
};

/** Human readable instruction for an OSRM step. */
export function instruction(s: Step, legCount: number): string {
  const name = s.name;
  const onto = name ? ` onto ${name}` : '';
  const mod = s.modifier ? MODIFIER_TEXT[s.modifier] ?? s.modifier : '';
  switch (s.type) {
    case 'depart':
      return `Head ${DIRS[Math.round(s.bearingAfter / 45) % 8]}${name ? ` on ${name}` : ''}`;
    case 'arrive':
      return s.legIndex === legCount - 1 ? 'Arrive at your destination' : `Arrive at stop ${s.legIndex + 1}`;
    case 'roundabout':
    case 'rotary':
      return s.exit ? `At the roundabout, take the ${ordinal(s.exit)} exit${onto}` : `Enter the roundabout${onto}`;
    case 'exit roundabout':
    case 'exit rotary':
      return `Exit the roundabout${onto}`;
    case 'roundabout turn':
      return `At the roundabout, turn ${mod}${onto}`;
    case 'merge':
      return `Merge${mod ? ` ${mod}` : ''}${onto}`;
    case 'on ramp':
      return `Take the ramp${onto}`;
    case 'off ramp':
      return `Take the exit${onto}`;
    case 'fork':
      return `Keep ${mod || 'straight'} at the fork${onto}`;
    case 'end of road':
      return `At the end of the road, turn ${mod}${onto}`;
    case 'new name':
      return `Continue${onto}`;
  }
  if (!mod || mod === 'straight') return `Continue ${name ? `on ${name}` : 'straight'}`;
  if (mod === 'uturn') return `Make a U-turn${onto}`;
  return `${s.type === 'continue' ? 'Keep' : 'Turn'} ${mod}${onto}`;
}
