import type { Profile } from './modes';
import type { LatLon, Place, Route, Step } from './types';

const ROUTER = 'https://routing.openstreetmap.de';
const PHOTON = 'https://photon.komoot.io';

interface OsrmStep {
  distance: number;
  duration: number;
  name: string;
  ref?: string;
  maneuver: { type: string; modifier?: string; exit?: number; bearing_after: number };
}
interface OsrmRoute {
  distance: number;
  duration: number;
  geometry: { coordinates: [number, number][] };
  legs: { summary: string; steps: OsrmStep[] }[];
}

function parseRoute(r: OsrmRoute): Route {
  const names = [
    ...new Set(r.legs.flatMap((l) => (l.summary || '').split(',').map((s) => s.trim()).filter(Boolean))),
  ].slice(0, 2);
  const steps: Step[] = r.legs.flatMap((leg, legIndex) =>
    leg.steps.map((s) => ({
      distance: s.distance,
      duration: s.duration,
      name: s.name || s.ref || '',
      type: s.maneuver.type,
      modifier: s.maneuver.modifier,
      exit: s.maneuver.exit,
      bearingAfter: s.maneuver.bearing_after,
      legIndex,
    })),
  );
  return {
    distance: r.distance,
    duration: r.duration,
    coords: r.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
    summary: names.length ? names.join(' and ') : 'unnamed roads',
    steps,
    legCount: r.legs.length,
  };
}

export async function fetchRoutes(profile: Profile, points: LatLon[], signal?: AbortSignal): Promise<Route[]> {
  const coords = points.map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
  // OSRM only computes alternatives for routes without intermediate stops.
  const alternatives = points.length === 2 ? '3' : 'false';
  const url = `${ROUTER}/routed-${profile}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true&alternatives=${alternatives}`;
  const res = await fetch(url, { signal });
  const data = await res.json().catch(() => null);
  if (!data) throw new Error(`Routing service error (${res.status})`);
  if (data.code !== 'Ok') {
    throw new Error(data.code === 'NoRoute' ? 'No route found between these places' : data.message || data.code);
  }
  return (data.routes as OsrmRoute[]).map(parseRoute);
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | undefined>;
}

function photonPlace(f: PhotonFeature): Place {
  const p = f.properties;
  const [lon, lat] = f.geometry.coordinates;
  const street = p.street ? [p.street, p.housenumber].filter(Boolean).join(' ') : '';
  const name = p.name || street || p.city || p.county || p.state || p.country || 'Unnamed place';
  const detail = [...new Set([p.name ? street : '', p.city || p.county, p.country])]
    .filter((x): x is string => !!x && x !== name)
    .join(', ');
  return { lat, lon, name, detail, label: detail ? `${name}, ${detail}` : name };
}

export async function searchPlaces(q: string, bias?: LatLon, signal?: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({ q, limit: '6' });
  if (bias) {
    params.set('lat', bias.lat.toFixed(4));
    params.set('lon', bias.lon.toFixed(4));
  }
  const res = await fetch(`${PHOTON}/api/?${params}`, { signal });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const data = await res.json();
  const places = (data.features as PhotonFeature[]).map(photonPlace);
  // Photon often returns the same place several times (node + way + relation).
  return places.filter((p, i) => places.findIndex((q) => q.label === p.label) === i);
}

export const coordLabel = (p: LatLon) => `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`;

export async function reverseGeocode(p: LatLon, signal?: AbortSignal): Promise<Place> {
  const res = await fetch(`${PHOTON}/reverse?lat=${p.lat}&lon=${p.lon}`, { signal });
  const data = res.ok ? await res.json() : null;
  const f = data?.features?.[0] as PhotonFeature | undefined;
  if (!f) return { ...p, label: coordLabel(p) };
  return { ...photonPlace(f), lat: p.lat, lon: p.lon };
}
