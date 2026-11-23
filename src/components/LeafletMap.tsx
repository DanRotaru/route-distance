import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { PoiCatId } from '../pois';
import type { MapImagery } from '../settings';
import { savedMarkerHtml } from './Icons';
import {
  COLORS,
  contextMenu,
  DEFAULT_TILES,
  DEFAULT_VIEW,
  escapeHtml,
  GOOGLE_TILES,
  labelPoints,
  poiCard,
  poiIconHtml,
  routeLabelHtml,
  savedCard,
  waypointIcon,
  waypointKind,
  type LeafletMapProps,
} from './mapCommon';

const poiIcons = new Map<PoiCatId, L.DivIcon>();
function poiIcon(cat: PoiCatId): L.DivIcon {
  let icon = poiIcons.get(cat);
  if (!icon) {
    icon = L.divIcon({ className: 'poi-wrap', html: poiIconHtml(cat), iconSize: [22, 22], iconAnchor: [11, 11] });
    poiIcons.set(cat, icon);
  }
  return icon;
}

/** Base layers; in the dark theme the street map is darkened by CSS (`.tiles-darken`), since free dark raster tiles need API keys. */
function makeBaseLayers(tiles: MapImagery, dark: boolean): { map: L.Layer; sat: L.Layer } {
  if (tiles === 'google') {
    const opts: L.TileLayerOptions = { maxZoom: 20, subdomains: GOOGLE_TILES.subdomains, attribution: 'Map data &copy; Google' };
    return {
      map: L.tileLayer(GOOGLE_TILES.map, { ...opts, className: dark ? 'tiles-darken' : '' }),
      sat: L.tileLayer(GOOGLE_TILES.sat, opts),
    };
  }
  return {
    map: L.tileLayer(DEFAULT_TILES.map, {
      maxZoom: 19,
      className: dark ? 'tiles-darken' : '',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }),
    sat: L.layerGroup([
      L.tileLayer(DEFAULT_TILES.sat, { maxZoom: 19, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics' }),
      L.tileLayer(DEFAULT_TILES.satLabels, { maxZoom: 19 }),
    ]),
  };
}

export function LeafletMap(props: LeafletMapProps & { tiles: MapImagery; dark: boolean; imperial: boolean }) {
  const { waypoints, routes, selected, modeId, profile, dotted, labels, fitRequest, layoutKey, base, pois, tiles, dark, saved, revealSaved, picking, imperial } = props;
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groups = useRef<{ pois: L.LayerGroup; saved: L.LayerGroup; routes: L.LayerGroup; labels: L.LayerGroup; markers: L.LayerGroup } | null>(null);
  const baseLayers = useRef<{ map: L.Layer; sat: L.Layer } | null>(null);
  const cb = useRef(props);
  cb.current = props;
  const lastProfile = useRef(profile);
  const pendingFit = useRef(false);

  useEffect(() => {
    const map = L.map(elRef.current!, { zoomControl: false, attributionControl: false }).setView([DEFAULT_VIEW.lat, DEFAULT_VIEW.lon], DEFAULT_VIEW.zoom);
    mapRef.current = map;
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // No attribution control: all credits are listed in the Credits modal (footer link).

    groups.current = {
      pois: L.layerGroup().addTo(map),
      saved: L.layerGroup().addTo(map),
      routes: L.layerGroup().addTo(map),
      labels: L.layerGroup().addTo(map),
      markers: L.layerGroup().addTo(map),
    };

    const openMenu = (latlng: L.LatLng) => {
      const p = { lat: latlng.lat, lon: latlng.lng };
      const el = contextMenu(
        p,
        (action) => {
          map.closePopup();
          cb.current.onContextAction(action, p);
        },
        () => map.closePopup(),
      );
      L.popup({ closeButton: false, className: 'ctx-popup', offset: [0, 0] }).setLatLng(latlng).setContent(el).openOn(map);
    };

    const report = () => {
      const c = map.getCenter();
      const b = map.getBounds();
      cb.current.onView(
        { lat: c.lat, lon: c.lng, zoom: map.getZoom() },
        { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() },
      );
      cb.current.onMoveEnd({ lat: c.lat, lon: c.lng });
    };

    map.on('click', (e) => {
      if (!cb.current.onMapClick({ lat: e.latlng.lat, lon: e.latlng.lng })) openMenu(e.latlng);
    });
    map.on('contextmenu', (e) => openMenu(e.latlng));
    map.on('moveend', report);
    report();

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Scale bar in the user's units.
  useEffect(() => {
    const scale = L.control.scale({ position: 'bottomright', metric: !imperial, imperial }).addTo(mapRef.current!);
    return () => {
      scale.remove();
    };
  }, [imperial]);

  // Base imagery: rebuilt when the tile source changes, swapped when toggling map/satellite.
  useEffect(() => {
    const map = mapRef.current!;
    baseLayers.current = makeBaseLayers(tiles, dark);
    return () => {
      const l = baseLayers.current!;
      map.removeLayer(l.map);
      map.removeLayer(l.sat);
    };
  }, [tiles, dark]);

  useEffect(() => {
    const map = mapRef.current!;
    const layers = baseLayers.current!;
    const [on, off] = base === 'map' ? [layers.map, layers.sat] : [layers.sat, layers.map];
    map.removeLayer(off);
    on.addTo(map);
  }, [base, tiles, dark]);

  useEffect(() => {
    const t = setTimeout(() => mapRef.current?.invalidateSize(), 220);
    return () => clearTimeout(t);
  }, [layoutKey]);

  // Keep Leaflet in sync while the container is resized (e.g. dragging the mobile bottom sheet).
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => mapRef.current?.invalidateSize({ pan: false }));
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  // Markers are diffed by place rather than rebuilt, so a marker's open popup survives the reload
  // that follows its own auto-pan (and any other small map move).
  const poiMarkers = useRef(new Map<string, L.Marker>());
  useEffect(() => {
    const map = mapRef.current!;
    const g = groups.current!.pois;
    const existing = poiMarkers.current;
    const wanted = new Set(pois.map((p) => p.osm));
    for (const [osm, m] of existing) {
      if (!wanted.has(osm)) {
        g.removeLayer(m);
        existing.delete(osm);
      }
    }
    for (const p of pois) {
      if (existing.has(p.osm)) continue;
      const m = L.marker([p.lat, p.lon], { icon: poiIcon(p.cat), zIndexOffset: -1000, keyboard: false });
      m.bindTooltip(escapeHtml(p.name), { direction: 'top', offset: [0, -10] });
      // Leaflet re-runs a content function on every popup.update(), so build the card only once
      // (otherwise the update after the details load would create a new card, which updates again, forever).
      let card: HTMLElement | null = null;
      m.bindPopup(
        () =>
          (card ??= poiCard(
            p,
            (action, d) => {
              map.closePopup();
              cb.current.onContextAction(action, { lat: p.lat, lon: p.lon }, d?.address ? `${p.name}, ${d.address}` : p.name);
            },
            () => m.getPopup()?.update(),
          )),
        { className: 'ctx-popup', offset: [0, -6], maxWidth: 300 },
      );
      g.addLayer(m);
      existing.set(p.osm, m);
    }
  }, [pois]);

  // Saved places (Home, Work, custom)
  const savedMarkers = useRef(new Map<string, L.Marker>());
  useEffect(() => {
    const map = mapRef.current!;
    const g = groups.current!.saved;
    g.clearLayers();
    savedMarkers.current.clear();
    for (const s of saved) {
      if (!s.point) continue;
      const p = s.point;
      const icon = L.divIcon({ className: 'mk-wrap', html: savedMarkerHtml(s.kind), iconSize: [24, 24], iconAnchor: [12, 12] });
      const m = L.marker([p.lat, p.lon], { icon, zIndexOffset: 500, keyboard: false });
      m.bindTooltip(escapeHtml(s.name), { direction: 'top', offset: [0, -12] });
      m.bindPopup(
        () =>
          savedCard(s, (action) => {
            map.closePopup();
            cb.current.onContextAction(action, p, s.name);
          }),
        { className: 'ctx-popup', offset: [0, -6] },
      );
      g.addLayer(m);
      savedMarkers.current.set(s.id, m);
    }
  }, [saved]);

  // Declared after the markers effect, so a pin saved in the same update already exists.
  useEffect(() => {
    const m = revealSaved && savedMarkers.current.get(revealSaved.id);
    if (!m) return;
    const map = mapRef.current!;
    map.setView(m.getLatLng(), Math.max(map.getZoom(), 16));
    m.openPopup();
  }, [revealSaved]);

  useEffect(() => {
    const map = mapRef.current!;
    map.getContainer().classList.toggle('picking', picking);
    if (picking) map.closePopup();
  }, [picking]);

  // Waypoint markers
  useEffect(() => {
    const g = groups.current!.markers;
    g.clearLayers();
    waypoints.forEach((w, i) => {
      if (!w.place) return;
      const ic = waypointIcon(waypointKind(i, waypoints.length), i);
      const icon = L.divIcon({ className: 'mk-wrap', html: ic.html, iconSize: ic.size, iconAnchor: ic.anchor });
      const m = L.marker([w.place.lat, w.place.lon], { icon, draggable: true, title: w.place.label, zIndexOffset: 2000 });
      m.on('dragend', () => {
        const ll = m.getLatLng();
        cb.current.onWaypointDrag(w.id, { lat: ll.lat, lon: ll.lng });
      });
      g.addLayer(m);
    });
  }, [waypoints]);

  // Route lines
  useEffect(() => {
    const g = groups.current!.routes;
    g.clearLayers();
    const order = routes.map((_, i) => i).filter((i) => i !== selected);
    if (routes[selected]) order.push(selected);
    for (const i of order) {
      const isSel = i === selected;
      const coords = routes[i].coords;
      const common = { bubblingMouseEvents: false, opacity: 1 };
      const lines: L.Polyline[] = dotted
        ? [
            L.polyline(coords, { color: isSel ? COLORS.sel : COLORS.alt, weight: isSel ? 8 : 7, dashArray: '0.1 12', lineCap: 'round', ...common }),
            L.polyline(coords, { ...common, opacity: 0, weight: 18 }), // click target
          ]
        : [
            L.polyline(coords, { color: isSel ? COLORS.selBorder : COLORS.altBorder, weight: isSel ? 10 : 9, ...common }),
            L.polyline(coords, { color: isSel ? COLORS.sel : COLORS.alt, weight: isSel ? 6 : 5, ...common }),
          ];
      for (const line of lines) {
        line.on('click', () => cb.current.onSelectRoute(i));
        g.addLayer(line);
      }
    }
  }, [routes, selected, dotted]);

  // Time bubbles on the routes
  const points = useMemo(() => labelPoints(routes), [routes]);
  useEffect(() => {
    const g = groups.current!.labels;
    g.clearLayers();
    routes.forEach((_, i) => {
      const lb = labels[i];
      if (!lb || !points[i]) return;
      const isSel = i === selected;
      const m = L.marker(points[i], {
        icon: L.divIcon({ className: 'rlabel-wrap', html: routeLabelHtml(lb, isSel, modeId), iconSize: [0, 0], iconAnchor: [0, 0] }),
        zIndexOffset: isSel ? 1000 : 0,
        keyboard: false,
      });
      m.on('click', () => cb.current.onSelectRoute(i));
      g.addLayer(m);
    });
  }, [routes, points, labels, selected, modeId]);

  // Fit to newly chosen places immediately, then to the routes once they arrive.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fitRequest) return;
    pendingFit.current = true;
    const pts = cb.current.waypoints.filter((w) => w.place).map((w) => [w.place!.lat, w.place!.lon] as L.LatLngTuple);
    if (pts.length === 1) map.setView(pts[0], Math.max(map.getZoom(), 15));
    else if (pts.length > 1) map.fitBounds(pts, { padding: [70, 70], maxZoom: 16 });
  }, [fitRequest]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !routes.length) return;
    const b = L.latLngBounds([]);
    routes.forEach((r) => r.coords.forEach((c) => b.extend(c)));
    // Also refit when switching to a mode whose routes don't fit the current view.
    const profileChanged = lastProfile.current !== profile;
    lastProfile.current = profile;
    if (pendingFit.current || (profileChanged && !map.getBounds().contains(b))) {
      pendingFit.current = false;
      map.fitBounds(b, { padding: [70, 70] });
    }
  }, [routes, profile]);

  return <div ref={elRef} className="map" />;
}
