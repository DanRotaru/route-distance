import { useEffect, useMemo, useState } from 'react';
import { fetchPois, POI_CATS, POI_MIN_ZOOM, type Poi, type PoiCatId } from '../pois';
import type { MapSettings } from '../settings';
import { Icon } from './Icons';
import { LeafletMap } from './LeafletMap';
import { DEFAULT_VIEW, layerThumb, type BaseLayer, type Bounds, type MapProps, type MapViewState } from './mapCommon';

export type { ContextAction, RouteLabel } from './mapCommon';

/** The Leaflet map plus its chrome (places chips, map/satellite toggle). */
export function MapView(props: MapProps & { settings: MapSettings; dark: boolean }) {
  const { settings, dark, loading } = props;
  const [base, setBase] = useState<BaseLayer>('map');
  const [view, setView] = useState<{ v: MapViewState; b: Bounds | null }>({ v: DEFAULT_VIEW, b: null });
  const [poisOn, setPoisOn] = useState(false);
  const [poiCat, setPoiCat] = useState<PoiCatId | null>(null);
  const [pois, setPois] = useState<Poi[]>([]);
  const [poiStatus, setPoiStatus] = useState<'idle' | 'loading' | 'zoom' | 'error'>('idle');

  // Places (shops, pharmacies, ...) for the visible area, loaded once the user stops moving the map.
  useEffect(() => {
    const minZoom = poiCat ? POI_MIN_ZOOM.one : POI_MIN_ZOOM.all;
    if (!poisOn || !view.b || view.v.zoom < minZoom) {
      setPois([]);
      setPoiStatus(poisOn ? 'zoom' : 'idle');
      return;
    }
    const b = view.b;
    const padLat = (b.north - b.south) * 0.2;
    const padLon = (b.east - b.west) * 0.2;
    let stale = false;
    const t = setTimeout(() => {
      setPoiStatus('loading');
      fetchPois({ south: b.south - padLat, west: b.west - padLon, north: b.north + padLat, east: b.east + padLon }, poiCat)
        .then((ps) => {
          if (stale) return;
          setPois(ps);
          setPoiStatus('idle');
        })
        .catch(() => {
          if (!stale) setPoiStatus('error');
        });
    }, 150);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [view, poisOn, poiCat]);

  const visiblePois = useMemo(() => (poiCat ? pois.filter((p) => p.cat === poiCat) : pois), [pois, poiCat]);

  const other = base === 'map' ? 'sat' : 'map';

  return (
    <div className="map-wrap">
      <LeafletMap {...props} base={base} pois={visiblePois} tiles={settings.imagery} dark={dark} imperial={settings.units === 'imperial'} onView={(v, b) => setView({ v, b })} />
      {loading && <div className="map-loading">Finding routes…</div>}
      <div className="poi-chips">
        <button className={`chip${poisOn ? ' on' : ''}`} onClick={() => setPoisOn((v) => !v)} title="Show places on the map">
          <Icon name="place" size={16} />
          Places
        </button>
        {poisOn &&
          POI_CATS.map((c) => (
            <button
              key={c.id}
              className={`chip${poiCat === c.id ? ' on' : ''}`}
              onClick={() => setPoiCat((cur) => (cur === c.id ? null : c.id))}
            >
              <svg viewBox="0 0 24 24" width={16} height={16} fill={c.color} aria-hidden="true">
                <path d={c.path} />
              </svg>
              {c.label}
            </button>
          ))}
        {poisOn && poiStatus !== 'idle' && (
          <span className={`chip-hint${poiStatus === 'error' ? ' err' : ''}`}>
            {poiStatus === 'loading' ? 'Loading places…' : poiStatus === 'zoom' ? 'Zoom in to see places' : 'Places unavailable'}
          </span>
        )}
      </div>
      <button className="layer-btn" onClick={() => setBase(other)}>
        <i
          className={`layer-thumb${dark && other === 'map' ? ' tiles-darken' : ''}`}
          style={{ backgroundImage: `url(${layerThumb(other, settings.imagery === 'google', view.v)})` }}
        />
        <span>
          <Icon name="layers" size={16} />
          {other === 'sat' ? 'Satellite' : 'Map'}
        </span>
      </button>
    </div>
  );
}
