export interface LatLon {
  lat: number;
  lon: number;
}

export interface Place extends LatLon {
  /** Full single-line label shown in the input. */
  label: string;
  /** Primary / secondary parts for suggestion lists. */
  name?: string;
  detail?: string;
}

export interface Waypoint {
  id: string;
  text: string;
  place: Place | null;
}

export interface Step {
  distance: number; // m
  duration: number; // s
  name: string;
  type: string;
  modifier?: string;
  exit?: number;
  bearingAfter: number;
  legIndex: number;
}

export interface Route {
  distance: number; // m
  duration: number; // s (OSRM estimate)
  coords: [number, number][]; // [lat, lon]
  summary: string;
  steps: Step[];
  legCount: number;
}

export interface ProfileState {
  status: 'idle' | 'loading' | 'ok' | 'error';
  routes: Route[];
  error?: string;
}

export type CalcMode = 'speed' | 'time';

export type Depart = { kind: 'now' } | { kind: 'at'; time: string };
