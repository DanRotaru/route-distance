import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { coordLabel, fetchRoutes, reverseGeocode } from './api';
import { formatDistance, formatDuration, formatSpeedUnit, requiredSpeed, travelSeconds } from './format';
import { MODE_BY_ID, MODES, PROFILES, type ModeId, type Profile } from './modes';
import { loadSavedPlaces, newSavedId, persistSavedPlaces, type SavedPlace } from './savedPlaces';
import { applyTheme, loadSettings, persistSettings, useDark, type MapSettings } from './settings';
import { loadInitialState, newWaypoint, persistPrefs, writeHash } from './state';
import type { CalcMode, Depart, LatLon, Place, ProfileState, Route, Waypoint } from './types';
import { Icon } from './components/Icons';
import { MapView, type ContextAction, type RouteLabel } from './components/MapView';
import { ModeTabs } from './components/ModeTabs';
import { PickBanner } from './components/PickBanner';
import { BmcIcon } from './components/BmcIcon';
import { CreditsModal } from './components/CreditsModal';
import { RouteDetails } from './components/RouteDetails';
import { RouteList } from './components/RouteList';
import { SettingsModal } from './components/SettingsModal';
import { SheetHandle } from './components/SheetHandle';
import { SpeedPanel } from './components/SpeedPanel';
import { MAX_WAYPOINTS, WaypointList } from './components/WaypointList';

const IDLE: Record<Profile, ProfileState> = {
  car: { status: 'idle', routes: [] },
  bike: { status: 'idle', routes: [] },
  foot: { status: 'idle', routes: [] },
};

function departTime(depart: Depart, now: number): number {
  if (depart.kind === 'now') return now;
  const [h, m] = depart.time.split(':').map(Number);
  const d = new Date(now);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.getTime();
}

export default function App() {
  const [init] = useState(loadInitialState);
  const [waypoints, setWaypoints] = useState<Waypoint[]>(init.waypoints);
  const [modeId, setModeId] = useState<ModeId>(init.modeId);
  const [speeds, setSpeeds] = useState(init.speeds);
  const [calc, setCalc] = useState<CalcMode>(init.calc);
  const [targetMin, setTargetMin] = useState(init.targetMin);
  const [depart, setDepart] = useState<Depart>({ kind: 'now' });
  const [results, setResults] = useState(IDLE);
  const [selected, setSelected] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [fitRequest, setFitRequest] = useState(() => (init.waypoints.some((w) => w.place) ? 1 : 0));
  const [focusId, setFocusId] = useState<string | null>(null);
  const [revealSaved, setRevealSaved] = useState<{ id: string } | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [sheetH, setSheetH] = useState<number | null>(null);
  const [sheetDragging, setSheetDragging] = useState(false);
  const [toast, setToast] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [settings, setSettings] = useState<MapSettings>(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [saved, setSaved] = useState<SavedPlace[]>(loadSavedPlaces);
  /** The saved place whose location is being chosen on the map (`back` reopens the settings afterwards,
   *  `wpId` is the waypoint to fill with it once chosen). */
  const [picking, setPicking] = useState<{ place: SavedPlace; back: boolean; wpId?: string } | null>(null);
  const biasRef = useRef<LatLon | undefined>(undefined);
  const cacheRef = useRef(new Map<string, Route[]>());

  const mode = MODE_BY_ID[modeId];
  const speed = speeds[modeId];
  const state = results[mode.profile];
  const routes = state.routes;
  const sel = Math.min(selected, Math.max(0, routes.length - 1));
  const departMs = departTime(depart, now);
  const targetSec = targetMin * 60;
  const units = settings.units;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => persistPrefs(modeId, speeds), [modeId, speeds]);
  useEffect(() => persistSettings(settings), [settings]);
  const dark = useDark(settings.theme);
  useEffect(() => applyTheme(dark, true), [dark]);
  useEffect(() => persistSavedPlaces(saved), [saved]);

  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cancelPicking();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => writeHash(waypoints, modeId, speed, calc, targetMin), [waypoints, modeId, speed, calc, targetMin]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  // Fetch routes for every profile so the mode tabs can show their values too.
  const filled = waypoints.filter((w) => w.place);
  const routeKey = filled.map((w) => `${w.place!.lon.toFixed(6)},${w.place!.lat.toFixed(6)}`).join(';');
  useEffect(() => {
    setSelected(0);
    setDetailsOpen(false);
    if (!routeKey.includes(';')) {
      setResults(IDLE);
      return;
    }
    const points = routeKey.split(';').map((s) => {
      const [lon, lat] = s.split(',').map(Number);
      return { lat, lon };
    });
    const ctrl = new AbortController();
    for (const profile of PROFILES) {
      const key = `${profile}|${routeKey}`;
      const cached = cacheRef.current.get(key);
      if (cached) {
        setResults((r) => ({ ...r, [profile]: { status: 'ok', routes: cached } }));
        continue;
      }
      setResults((r) => ({ ...r, [profile]: { ...r[profile], status: 'loading' } }));
      fetchRoutes(profile, points, ctrl.signal)
        .then((rs) => {
          cacheRef.current.set(key, rs);
          setResults((r) => ({ ...r, [profile]: { status: 'ok', routes: rs } }));
        })
        .catch((e: Error) => {
          if (ctrl.signal.aborted) return;
          setResults((r) => ({ ...r, [profile]: { status: 'error', routes: [], error: e.message } }));
        });
    }
    return () => ctrl.abort();
  }, [routeKey]);

  useEffect(() => {
    setSelected(0);
    setDetailsOpen(false);
  }, [mode.profile]);

  // ---- waypoint editing ----
  const patchWaypoint = (id: string, patch: Partial<Waypoint>) =>
    setWaypoints((ws) => ws.map((w) => (w.id === id ? { ...w, ...patch } : w)));

  function choosePlace(id: string, place: Place | null) {
    patchWaypoint(id, { place, text: place?.label ?? '' });
    if (place) setFitRequest((n) => n + 1);
  }

  /** Put a map point into a waypoint (or a new one), then resolve its address in the background. */
  function setPointAt(index: number, p: LatLon, opts: { insert?: boolean; fit?: boolean; label?: string } = {}) {
    const place: Place = { ...p, label: opts.label ?? coordLabel(p) };
    let id: string;
    if (opts.insert) {
      const w = newWaypoint(place);
      id = w.id;
      setWaypoints((ws) => [...ws.slice(0, index), w, ...ws.slice(index)]);
    } else {
      id = waypoints[index].id;
      patchWaypoint(id, { place, text: place.label });
    }
    if (opts.fit) setFitRequest((n) => n + 1);
    if (opts.label) return;
    reverseGeocode(p)
      .then((found) =>
        setWaypoints((ws) =>
          ws.map((w) =>
            w.id === id && w.place?.lat === p.lat && w.place.lon === p.lon
              ? { ...w, place: { ...w.place, label: found.label }, text: found.label }
              : w,
          ),
        ),
      )
      .catch(() => {});
  }

  // ---- saved places ----
  function startPicking(place: SavedPlace, back: boolean, wpId?: string) {
    setSettingsOpen(false);
    setPicking({ place, back, wpId });
  }

  function cancelPicking() {
    if (picking?.back) setSettingsOpen(true);
    setPicking(null);
  }

  /** Save the chosen point; `address` is known when it came from a search, otherwise it's looked up. */
  function savePickedPoint(p: LatLon, address?: string) {
    if (!picking) return;
    const { place, back, wpId } = picking;
    const point = { lat: p.lat, lon: p.lon };
    setSaved((list) =>
      list.some((s) => s.id === place.id)
        ? list.map((s) => (s.id === place.id ? { ...s, point, address } : s))
        : [...list, { ...place, point, address }],
    );
    // Found by search while no start/destination is chosen: show its pin with the directions popup
    // instead of going back to Settings.
    const reveal = !wpId && !!address && !filled.length;
    setPicking(null);
    if (back && !reveal) setSettingsOpen(true);
    if (wpId) choosePlace(wpId, { ...point, label: place.name, name: place.name });
    if (reveal) setRevealSaved({ id: place.id });
    setToast(`${place.name} saved`);
    if (address) return;
    reverseGeocode(p)
      .then((found) =>
        setSaved((list) =>
          list.map((s) => (s.id === place.id && s.point === point ? { ...s, address: found.label } : s)),
        ),
      )
      .catch(() => {});
  }

  function removeSaved(place: SavedPlace) {
    setSaved((list) =>
      place.kind === 'custom'
        ? list.filter((s) => s.id !== place.id)
        : list.map((s) => (s.id === place.id ? { ...s, point: null, address: undefined } : s)),
    );
  }

  function onMapClick(p: LatLon) {
    if (picking) {
      savePickedPoint(p);
      return true;
    }
    const idx = waypoints.findIndex((w) => !w.place);
    if (idx < 0) return false;
    setPointAt(idx, p, { fit: filled.length === 1 });
    return true;
  }

  function onContextAction(action: ContextAction, p: LatLon, label?: string) {
    if (action === 'from') setPointAt(0, p, { label });
    else if (action === 'to') setPointAt(waypoints.length - 1, p, { label });
    else if (waypoints.length < MAX_WAYPOINTS) setPointAt(waypoints.length - 1, p, { insert: true, label });
  }

  function onWaypointDrag(id: string, p: LatLon) {
    const idx = waypoints.findIndex((w) => w.id === id);
    if (idx >= 0) setPointAt(idx, p);
  }

  function addWaypoint() {
    const w = newWaypoint();
    setWaypoints((ws) => [...ws, w]);
    setFocusId(w.id);
  }

  function removeWaypoint(id: string) {
    setWaypoints((ws) => (ws.length > 2 ? ws.filter((w) => w.id !== id) : ws));
  }

  function clearAll() {
    setWaypoints([newWaypoint(), newWaypoint()]);
    setDetailsOpen(false);
  }

  // Nothing to clear (no place chosen, nothing typed): the X button hides the side panel instead.
  const isEmpty = waypoints.every((w) => !w.place && !w.text.trim());

  const setSpeed = (v: number) => setSpeeds((s) => ({ ...s, [modeId]: v }));

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.href);
      setToast('Link copied');
    } catch {
      setToast('Could not copy link');
    }
  }

  // ---- derived display values ----
  const modeValues = MODES.map((m) => {
    const st = results[m.profile];
    if (!st.routes.length) return st.status === 'loading' ? '…' : st.status === 'error' ? '—' : '';
    const d = Math.min(...st.routes.map((r) => r.distance));
    return calc === 'speed'
      ? formatDuration(travelSeconds(d, speeds[m.id]))
      : formatSpeedUnit(requiredSpeed(d, targetSec), units);
  });

  const labels = useMemo<RouteLabel[]>(
    () =>
      routes.map((r) => ({
        title: calc === 'speed' ? formatDuration(travelSeconds(r.distance, speed)) : formatSpeedUnit(requiredSpeed(r.distance, targetSec), units),
        sub: formatDistance(r.distance, units),
      })),
    [routes, calc, speed, targetSec, units],
  );

  const selRoute = routes[sel];
  const routeKmh = selRoute && (calc === 'speed' ? speed : requiredSpeed(selRoute.distance, targetSec));

  return (
    <div
      className={`app${collapsed ? ' collapsed' : ''}${sheetDragging ? ' sheet-dragging' : ''}`}
      style={sheetH != null ? ({ '--sheet-h': `${sheetH}px` } as CSSProperties) : undefined}
    >
      <aside className="sidebar">
        <SheetHandle height={sheetH} onHeight={setSheetH} onDragging={setSheetDragging} />
        <header className="side-header">
          <h1>
            <Icon name="place" size={22} />
            Route Distance
          </h1>
          <button className="icon-btn" title="Settings" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
            <Icon name="settings" size={22} />
          </button>
        </header>
        <div className="sidebar-scroll">
          <div className="panel-top">
            <ModeTabs
              modeId={modeId}
              values={modeValues}
              clearTitle={isEmpty ? 'Hide side panel' : 'Clear route'}
              onMode={setModeId}
              onClear={isEmpty ? () => setCollapsed(true) : clearAll}
            />
            <WaypointList
              waypoints={waypoints}
              focusId={focusId}
              saved={saved}
              onSetSaved={(s, wpId) => startPicking(s, false, wpId)}
              getBias={() => biasRef.current}
              onText={(id, text) => patchWaypoint(id, { text })}
              onPlace={choosePlace}
              onRemove={removeWaypoint}
              onSwap={() => setWaypoints((ws) => [...ws].reverse())}
              onAdd={addWaypoint}
            />
            <div className="depart-row">
              <label className="pill-select">
                <Icon name="schedule" size={18} />
                <select
                  value={depart.kind}
                  onChange={(e) => {
                    const d = new Date();
                    const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                    setDepart(e.target.value === 'now' ? { kind: 'now' } : { kind: 'at', time: hhmm });
                  }}
                >
                  <option value="now">Leave now</option>
                  <option value="at">Depart at</option>
                </select>
              </label>
              {depart.kind === 'at' && (
                <input
                  className="time-input"
                  type="time"
                  value={depart.time}
                  onChange={(e) => setDepart({ kind: 'at', time: e.target.value })}
                />
              )}
            </div>
          </div>

          <SpeedPanel
            mode={mode}
            calc={calc}
            speed={speed}
            targetMin={targetMin}
            units={units}
            onCalc={setCalc}
            onSpeed={setSpeed}
            onTarget={setTargetMin}
          />

          <div className="sep" />
          <div className="actions">
            <button className="link-btn" onClick={copyLink} disabled={filled.length < 2}>
              <Icon name="link" size={20} /> Copy link
            </button>
          </div>

          {detailsOpen && selRoute ? (
            <RouteDetails
              route={selRoute}
              kmh={routeKmh}
              departMs={departMs}
              units={units}
              stopLabels={filled.map((w) => w.place!.label)}
              onBack={() => setDetailsOpen(false)}
            />
          ) : (
            <RouteList
              state={state}
              mode={mode}
              calc={calc}
              speed={speed}
              targetMin={targetMin}
              units={units}
              departMs={departMs}
              selected={sel}
              onSelect={setSelected}
              onDetails={() => setDetailsOpen(true)}
              onUseSpeed={(v) => {
                setSpeed(v);
                setCalc('speed');
              }}
            />
          )}

          <footer className="credit">
            <button className="credit-link" onClick={() => setCreditsOpen(true)}>
              Map &amp; data credits
            </button>
            <span className="credit-sep" aria-hidden="true">
              ·
            </span>
            <a href="https://dan13.me/?utm_source=route-distance" target="_blank" rel="noopener">
              Created with <span>❤️</span> by DanRotaru
            </a>
            <a
              className="coffee-link"
              href="https://buymeacoffee.com/widget/page/danrotaru"
              target="_blank"
              rel="noopener noreferrer"
              title="Buy me a coffee"
              aria-label="Buy me a coffee"
            >
              <BmcIcon size={18} />
            </a>
          </footer>
        </div>
      </aside>

      <div className="map-area">
        <button
          className="collapse-btn"
          title={collapsed ? 'Expand side panel' : 'Collapse side panel'}
          onClick={() => setCollapsed((c) => !c)}
        >
          <Icon name="chevronLeft" size={20} />
        </button>
        <MapView
          settings={settings}
          dark={dark}
          waypoints={waypoints}
          routes={routes}
          selected={sel}
          modeId={modeId}
          profile={mode.profile}
          dotted={mode.profile === 'foot'}
          loading={state.status === 'loading'}
          labels={labels}
          fitRequest={fitRequest}
          layoutKey={String(collapsed)}
          saved={saved}
          revealSaved={revealSaved}
          picking={!!picking}
          onSelectRoute={setSelected}
          onMapClick={onMapClick}
          onContextAction={onContextAction}
          onWaypointDrag={onWaypointDrag}
          onMoveEnd={(c) => (biasRef.current = c)}
        />
        {picking && (
          <PickBanner
            key={picking.place.id}
            place={picking.place}
            getBias={() => biasRef.current}
            onFound={(p) => savePickedPoint(p, p.label)}
            onCancel={cancelPicking}
          />
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}
      {creditsOpen && <CreditsModal imagery={settings.imagery} onClose={() => setCreditsOpen(false)} />}
      {settingsOpen && (
        <SettingsModal
          settings={settings}
          saved={saved}
          onChange={setSettings}
          onClose={() => setSettingsOpen(false)}
          onPick={(s) => startPicking(s, true)}
          onPickNew={(name) => startPicking({ id: newSavedId(), kind: 'custom', name, point: null }, true)}
          onRemove={removeSaved}
        />
      )}
    </div>
  );
}
