import type { ModeId, Profile } from '../modes';
import { fetchPoiDetails, POI_CAT_BY_ID, type Poi, type PoiCatId, type PoiDetails } from '../pois';
import type { SavedPlace } from '../savedPlaces';
import type { LatLon, Route, Waypoint } from '../types';
import { MODE_SVG, PIN_SVG } from './Icons';

export type ContextAction = 'from' | 'to' | 'stop';
export interface RouteLabel {
  title: string;
  sub: string;
}

/** Props App passes to the map. */
export interface MapProps {
  waypoints: Waypoint[];
  routes: Route[];
  selected: number;
  modeId: ModeId;
  profile: Profile;
  dotted: boolean;
  loading: boolean;
  labels: RouteLabel[];
  fitRequest: number;
  layoutKey: string;
  saved: SavedPlace[];
  /** Move to this saved place's pin and open its popup (a new object per request). */
  revealSaved: { id: string } | null;
  /** Choosing a saved place's location: map clicks go to onMapClick and the cursor is a crosshair. */
  picking: boolean;
  onSelectRoute(i: number): void;
  /** Returns false when the click was not consumed (the map then shows its context menu). */
  onMapClick(p: LatLon): boolean;
  /** `label` is set when the point is a named place (e.g. a shop picked on the map). */
  onContextAction(a: ContextAction, p: LatLon, label?: string): void;
  onWaypointDrag(id: string, p: LatLon): void;
  onMoveEnd(center: LatLon): void;
}

export type BaseLayer = 'map' | 'sat';
export interface MapViewState extends LatLon {
  zoom: number;
}
export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** What the Leaflet map gets on top of the App props (the chrome around it lives in MapView). */
export interface LeafletMapProps extends MapProps {
  base: BaseLayer;
  pois: Poi[];
  onView(v: MapViewState, b: Bounds): void;
}

/** Initial view: Chișinău. */
export const DEFAULT_VIEW: MapViewState = { lat: 47.0245, lon: 28.8323, zoom: 13 };

export const COLORS = {
  sel: '#4a5cff',
  selBorder: '#2433b8',
  alt: '#a9b6ff',
  altBorder: '#6f7fd6',
};

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function sample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = arr.length / max;
  return Array.from({ length: max }, (_, i) => arr[Math.floor(i * step)]);
}

/** For each route pick a point that is as far as possible from the other routes, so labels don't stack. */
export function labelPoints(routes: Route[]): [number, number][] {
  return routes.map((r, i) => {
    const mid = r.coords[Math.floor(r.coords.length / 2)];
    const others = routes.filter((_, j) => j !== i).flatMap((o) => sample(o.coords, 400));
    if (!others.length) return mid;
    const cosLat = Math.cos((mid[0] * Math.PI) / 180);
    const inner = r.coords.slice(Math.floor(r.coords.length * 0.15), Math.ceil(r.coords.length * 0.85));
    let best = mid;
    let bestD = -1;
    for (const c of sample(inner, 80)) {
      let d = Infinity;
      for (const o of others) {
        const dx = (c[1] - o[1]) * cosLat;
        const dy = c[0] - o[0];
        d = Math.min(d, dx * dx + dy * dy);
      }
      if (d > bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  });
}

const CTX_ITEMS: [string, ContextAction][] = [
  ['Directions from here', 'from'],
  ['Directions to here', 'to'],
  ['Add as a stop', 'stop'],
];

function ctxButtons(onAction: (a: ContextAction) => void): HTMLElement {
  const el = document.createElement('div');
  el.className = 'ctx-menu';
  for (const [text, action] of CTX_ITEMS) {
    const b = document.createElement('button');
    b.textContent = text;
    b.onclick = () => onAction(action);
    el.appendChild(b);
  }
  return el;
}

/** Right-click / empty-click menu for a map point; the coordinates row has a close (×) button. */
export function contextMenu(p: LatLon, onAction: (a: ContextAction) => void, onClose: () => void): HTMLElement {
  const el = ctxButtons(onAction);
  const row = document.createElement('div');
  row.className = 'ctx-coords';
  const coords = document.createElement('span');
  coords.textContent = `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`;
  const close = document.createElement('button');
  close.className = 'ctx-close';
  close.title = 'Close';
  close.setAttribute('aria-label', 'Close');
  close.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="${CLOSE_PATH}"/></svg>`;
  close.onclick = onClose;
  row.append(coords, close);
  el.appendChild(row);
  return el;
}

const CLOSE_PATH = 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z';

const poiGlyph = (path: string) => `<svg viewBox="0 0 24 24" fill="#fff"><path d="${path}"/></svg>`;

export function poiIconHtml(cat: PoiCatId): string {
  const c = POI_CAT_BY_ID[cat];
  return `<div class="poi" style="background:${c.color}">${poiGlyph(c.path)}</div>`;
}

function detailRows(d: PoiDetails): string {
  const rows: string[] = [];
  if (d.cuisine) rows.push(`<div class="poi-row">${escapeHtml(d.cuisine)}</div>`);
  if (d.address) rows.push(`<div class="poi-row">${escapeHtml(d.address)}</div>`);
  if (d.hours) rows.push(`<div class="poi-row"><b>Hours:</b> ${escapeHtml(d.hours)}</div>`);
  if (d.phone) rows.push(`<div class="poi-row"><a href="tel:${escapeHtml(d.phone.replace(/[^\d+]/g, ''))}">${escapeHtml(d.phone)}</a></div>`);
  if (d.website && /^https?:\/\//i.test(d.website)) {
    const host = d.website.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
    rows.push(`<div class="poi-row"><a href="${escapeHtml(d.website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(host)}</a></div>`);
  }
  return rows.join('');
}

/** Popup card for a place; the details row fills in once Nominatim answers (`onResize` lets the popup re-layout). */
export function poiCard(p: Poi, onAction: (a: ContextAction, d: PoiDetails | null) => void, onResize: () => void): HTMLElement {
  const c = POI_CAT_BY_ID[p.cat];
  const el = document.createElement('div');
  el.className = 'poi-card';
  el.innerHTML = `<div class="poi-head"><span class="poi" style="background:${c.color}">${poiGlyph(c.path)}</span><div><b>${escapeHtml(p.name)}</b><span>${escapeHtml(p.kind)}</span></div></div>`;
  const info = document.createElement('div');
  info.innerHTML = '<div class="poi-row poi-muted">Loading details…</div>';
  el.appendChild(info);
  let details: PoiDetails | null = null;
  fetchPoiDetails(p.osm)
    .then((d) => {
      details = d;
      info.innerHTML = detailRows(d);
    })
    .catch(() => (info.innerHTML = ''))
    .finally(onResize);
  el.appendChild(ctxButtons((a) => onAction(a, details)));
  return el;
}

/** Popup for a saved place marker: its name and address, then the directions actions. */
export function savedCard(s: SavedPlace, onAction: (a: ContextAction) => void): HTMLElement {
  const el = ctxButtons(onAction);
  const head = document.createElement('div');
  head.className = 'saved-pop';
  head.innerHTML = `<b>${escapeHtml(s.name)}</b>${s.address ? `<span>${escapeHtml(s.address)}</span>` : ''}`;
  el.prepend(head);
  return el;
}

export type WaypointKind = 'origin' | 'stop' | 'dest';
export const waypointKind = (i: number, n: number): WaypointKind => (i === 0 ? 'origin' : i === n - 1 ? 'dest' : 'stop');

/** Marker markup with its size and anchor (pixels from the top-left). */
export function waypointIcon(kind: WaypointKind, i: number): { html: string; size: [number, number]; anchor: [number, number] } {
  return kind === 'dest'
    ? { html: PIN_SVG, size: [28, 40], anchor: [14, 39] }
    : { html: `<div class="mk mk-${kind}">${kind === 'stop' ? i : ''}</div>`, size: [20, 20], anchor: [10, 10] };
}

export function routeLabelHtml(lb: RouteLabel, isSel: boolean, modeId: ModeId): string {
  return `<div class="rlabel${isSel ? ' sel' : ''}"><svg viewBox="0 0 24 24" fill="currentColor">${MODE_SVG[modeId]}</svg><div><b>${escapeHtml(lb.title)}</b><span>${escapeHtml(lb.sub)}</span></div></div>`;
}

// ---- tiles ----
export const GOOGLE_TILES = {
  map: 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
  sat: 'https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',
  subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
};
export const DEFAULT_TILES = {
  map: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  sat: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  satLabels: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
};

function tileFor(lat: number, lon: number, z: number) {
  const n = 2 ** z;
  const rad = (lat * Math.PI) / 180;
  const x = Math.floor(((lon + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  return { x, y, z };
}

/** Preview image for the map/satellite toggle button. */
export function layerThumb(layer: BaseLayer, google: boolean, view: MapViewState): string {
  const t = tileFor(view.lat, view.lon, Math.max(3, Math.min(17, Math.round(view.zoom) - 1)));
  const url = google ? GOOGLE_TILES[layer].replace('{s}', 'mt1') : DEFAULT_TILES[layer];
  return url.replace('{x}', String(t.x)).replace('{y}', String(t.y)).replace('{z}', String(t.z));
}
