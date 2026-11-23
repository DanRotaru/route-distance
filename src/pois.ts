import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';
import type { LatLon } from './types';

// Place markers come from OpenFreeMap vector tiles (OpenMapTiles schema, `poi` layer): free, keyless and CDN-backed.
// Details (address, hours, phone, website) are looked up per place on click via Nominatim.
const TILEJSON = 'https://tiles.openfreemap.org/planet';
const NOMINATIM = 'https://nominatim.openstreetmap.org';
/** Highest zoom of the tileset; its tiles contain every POI. */
const TILE_Z = 14;

export type PoiCatId = 'food' | 'cafe' | 'grocery' | 'shop' | 'pharmacy' | 'health' | 'fuel' | 'bank' | 'hotel';

export interface PoiCat {
  id: PoiCatId;
  label: string;
  color: string;
  /** Inner SVG path (24x24 viewBox). */
  path: string;
  /** Matches OpenMapTiles poi `class` / `subclass` values. */
  match(cls: string, sub: string): boolean;
}

export interface Poi extends LatLon {
  id: string;
  cat: PoiCatId;
  name: string;
  kind: string;
  /** OSM reference for detail lookup, e.g. "N3721642654". */
  osm: string;
}

const set = (...v: string[]) => new Set(v);
const FOOD = set('restaurant', 'fast_food', 'bar', 'pub', 'food_court', 'biergarten');
const CAFE = set('cafe', 'ice_cream');
const GROCERY = set('supermarket', 'convenience', 'greengrocer', 'bakery', 'butcher', 'deli', 'alcohol', 'beverages', 'grocery');
const HEALTH = set('hospital', 'clinic', 'doctors', 'dentist');
const FUEL = set('fuel', 'charging_station');
const BANK = set('bank', 'atm', 'bureau_de_change');
const SHOP_CLASSES = set('shop', 'clothing_store', 'alcohol_shop', 'grocery');

// Material Design icon paths (Apache 2.0). Order matters: the first matching category wins.
export const POI_CATS: PoiCat[] = [
  {
    id: 'pharmacy',
    label: 'Pharmacies',
    color: '#e8336d',
    path: 'M21 5h-2.64l1.14-3.14L17.15 1l-1.46 4H3v2l2 6-2 6v2h18v-2l-2-6 2-6V5zm-5 9h-3v3h-2v-3H8v-2h3V9h2v3h3v2z',
    match: (c, s) => c === 'pharmacy' || s === 'pharmacy',
  },
  {
    id: 'grocery',
    label: 'Groceries',
    color: '#1a73e8',
    path: 'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z',
    match: (_, s) => GROCERY.has(s),
  },
  {
    id: 'food',
    label: 'Restaurants',
    color: '#e8710a',
    path: 'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z',
    match: (_, s) => FOOD.has(s),
  },
  {
    id: 'cafe',
    label: 'Coffee',
    color: '#b06000',
    path: 'M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.9 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z',
    match: (_, s) => CAFE.has(s),
  },
  {
    id: 'fuel',
    label: 'Gas',
    color: '#129eaf',
    path: 'M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33 0 1.38 1.12 2.5 2.5 2.5.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v16h10v-7.5h1.5v5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V9c0-.69-.28-1.32-.73-1.77zM12 10H6V5h6v5zm6 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z',
    match: (_, s) => FUEL.has(s),
  },
  {
    id: 'bank',
    label: 'ATMs & banks',
    color: '#7b61ff',
    path: 'M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zm-4.5-9L2 6v2h19V6l-9.5-5z',
    match: (_, s) => BANK.has(s),
  },
  {
    id: 'health',
    label: 'Hospitals',
    color: '#d93025',
    path: 'M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z',
    match: (_, s) => HEALTH.has(s),
  },
  {
    id: 'hotel',
    label: 'Hotels',
    color: '#c5221f',
    path: 'M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z',
    match: (c) => c === 'lodging',
  },
  {
    id: 'shop',
    label: 'Shopping',
    color: '#4285f4',
    path: 'M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-1.99.9-1.99 2L3 20c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm0 10c-2.76 0-5-2.24-5-5h2c0 1.66 1.34 3 3 3s3-1.34 3-3h2c0 2.76-2.24 5-5 5z',
    match: (c) => SHOP_CLASSES.has(c),
  },
];

export const POI_CAT_BY_ID = Object.fromEntries(POI_CATS.map((c) => [c.id, c])) as Record<PoiCatId, PoiCat>;

/** Minimum map zoom at which places are shown: everything, or a single chosen category. */
export const POI_MIN_ZOOM = { all: 16, one: 15 };
/** Never request more tiles than this for one view. */
const MAX_TILES = 30;

export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

const humanize = (s: string) => (s.charAt(0).toUpperCase() + s.slice(1)).replace(/_/g, ' ');

// The tile URL contains the dataset version, so it is read from the TileJSON.
let tileUrl: Promise<string> | null = null;
function getTileUrl(): Promise<string> {
  tileUrl ??= fetch(TILEJSON)
    .then((r) => {
      if (!r.ok) throw new Error(`Places service error (${r.status})`);
      return r.json();
    })
    .then((tj: { tiles: string[] }) => tj.tiles[0])
    .catch((e) => {
      tileUrl = null; // retry on the next call
      throw e;
    });
  return tileUrl;
}

const OSM_TYPE: Record<number, string> = { 1: 'N', 2: 'W', 3: 'R' };

function decodeTile(buf: ArrayBuffer, x: number, y: number): Poi[] {
  const layer = new VectorTile(new Pbf(new Uint8Array(buf))).layers.poi;
  if (!layer) return [];
  const n = 2 ** TILE_Z;
  const pois: Poi[] = [];
  for (let i = 0; i < layer.length; i++) {
    const f = layer.feature(i);
    const p = f.properties;
    const cls = String(p.class ?? '');
    const sub = String(p.subclass ?? '');
    const cat = POI_CATS.find((c) => c.match(cls, sub));
    if (!cat) continue;
    const pt = f.loadGeometry()[0]?.[0];
    if (!pt) continue;
    const lon = ((x + pt.x / layer.extent) / n) * 360 - 180;
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + pt.y / layer.extent)) / n))) * 180) / Math.PI;
    // OpenMapTiles feature ids are osm_id * 10 + (1 node | 2 way | 3 relation).
    const fid = f.id ?? 0;
    const osm = `${OSM_TYPE[fid % 10] ?? 'N'}${Math.floor(fid / 10)}`;
    const kind = humanize(sub || cls);
    pois.push({ id: `${osm}@${x}/${y}`, lat, lon, cat: cat.id, name: String(p.name ?? '') || kind, kind, osm });
  }
  return pois;
}

const tileCache = new Map<string, Promise<Poi[]>>();
function loadTile(x: number, y: number): Promise<Poi[]> {
  const key = `${x}/${y}`;
  let p = tileCache.get(key);
  if (!p) {
    p = getTileUrl()
      .then((url) => fetch(url.replace('{z}', String(TILE_Z)).replace('{x}', String(x)).replace('{y}', String(y))))
      .then((r) => {
        if (r.status === 204 || r.status === 404) return []; // empty area
        if (!r.ok) throw new Error(`Places service error (${r.status})`);
        return r.arrayBuffer().then((b) => decodeTile(b, x, y));
      });
    p.catch(() => tileCache.delete(key));
    tileCache.set(key, p);
  }
  return p;
}

function tileXY(lat: number, lon: number) {
  const n = 2 ** TILE_Z;
  const rad = (lat * Math.PI) / 180;
  return {
    x: Math.floor(((lon + 180) / 360) * n),
    y: Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n),
  };
}

export async function fetchPois(b: Bounds, cat: PoiCatId | null): Promise<Poi[]> {
  const nw = tileXY(b.north, b.west);
  const se = tileXY(b.south, b.east);
  const tiles: Promise<Poi[]>[] = [];
  for (let x = nw.x; x <= se.x; x++) for (let y = nw.y; y <= se.y; y++) tiles.push(loadTile(x, y));
  if (tiles.length > MAX_TILES) return [];
  const all = (await Promise.all(tiles)).flat();
  // A place drawn as an area may appear in several tiles; keep one.
  const seen = new Set<string>();
  return all.filter((p) => {
    if (cat && p.cat !== cat) return false;
    if (p.lat < b.south || p.lat > b.north || p.lon < b.west || p.lon > b.east) return false;
    if (seen.has(p.osm)) return false;
    seen.add(p.osm);
    return true;
  });
}

export interface PoiDetails {
  address?: string;
  hours?: string;
  phone?: string;
  website?: string;
  cuisine?: string;
}

const detailCache = new Map<string, Promise<PoiDetails>>();

/** Address, opening hours, phone and website from Nominatim (one request per clicked place). */
export function fetchPoiDetails(osm: string): Promise<PoiDetails> {
  let p = detailCache.get(osm);
  if (!p) {
    p = fetch(`${NOMINATIM}/lookup?osm_ids=${osm}&format=jsonv2&extratags=1&addressdetails=1`)
      .then((r) => {
        if (!r.ok) throw new Error(`Details unavailable (${r.status})`);
        return r.json();
      })
      .then((data: { address?: Record<string, string>; extratags?: Record<string, string> }[]) => {
        const d = data[0];
        if (!d) return {};
        const a = d.address ?? {};
        const t = d.extratags ?? {};
        const street = [a.road || a.pedestrian || a.footway, a.house_number].filter(Boolean).join(' ');
        return {
          address: [street, a.city || a.town || a.village].filter(Boolean).join(', ') || undefined,
          hours: t.opening_hours,
          phone: (t.phone || t['contact:phone'])?.split(';')[0].trim(),
          website: t.website || t['contact:website'],
          cuisine: t.cuisine?.split(';').map(humanize).join(', '),
        };
      });
    p.catch(() => detailCache.delete(osm));
    detailCache.set(osm, p);
  }
  return p;
}
