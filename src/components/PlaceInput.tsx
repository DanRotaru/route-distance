import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { searchPlaces } from '../api';
import { exactSaved, matchSaved, savedToPlace, type SavedPlace } from '../savedPlaces';
import type { LatLon, Place, Waypoint } from '../types';
import { Icon, savedIconName } from './Icons';

interface Props {
  waypoint: Waypoint;
  placeholder: string;
  autoFocus?: boolean;
  saved: SavedPlace[];
  getBias(): LatLon | undefined;
  onText(text: string): void;
  onPlace(place: Place | null): void;
  /** Start choosing the location of a saved place (Home/Work not set yet) on the map. */
  onSetSaved(s: SavedPlace): void;
}

type Option = { kind: 'loc' } | { kind: 'saved'; s: SavedPlace } | { kind: 'result'; p: Place };

export function PlaceInput({ waypoint, placeholder, autoFocus, saved, getBias, onText, onPlace, onSetSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Place[]>([]);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const timer = useRef<number | undefined>(undefined);
  const ctrl = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => () => {
    clearTimeout(timer.current);
    ctrl.current?.abort();
  }, []);

  function search(q: string) {
    clearTimeout(timer.current);
    ctrl.current?.abort();
    if (q.trim().length < 2) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = window.setTimeout(() => {
      const c = new AbortController();
      ctrl.current = c;
      searchPlaces(q, getBias(), c.signal)
        .then((r) => {
          setItems(r);
          setActive(-1);
        })
        .catch(() => !c.signal.aborted && setItems([]))
        .finally(() => !c.signal.aborted && setLoading(false));
    }, 300);
  }

  function close() {
    clearTimeout(timer.current);
    ctrl.current?.abort();
    setLoading(false);
    setOpen(false);
    setItems([]);
    inputRef.current?.blur();
  }

  function pick(p: Place) {
    onPlace(p);
    close();
  }

  function useMyLocation() {
    setGeoError('');
    if (!navigator.geolocation) return setGeoError('Location is not available in this browser');
    navigator.geolocation.getCurrentPosition(
      (pos) => pick({ lat: pos.coords.latitude, lon: pos.coords.longitude, label: 'Your location' }),
      (err) => setGeoError(err.message || 'Could not get your location'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  // Empty input: every saved place (unset Home/Work offer to be set). Typing: saved places matching the name.
  const text = waypoint.text;
  const typing = text.trim() !== '' && text !== waypoint.place?.label;
  const savedOpts = typing ? matchSaved(saved, text) : saved.filter((s) => s.point || s.kind !== 'custom');
  const options: Option[] = [
    { kind: 'loc' },
    ...savedOpts.map((s): Option => ({ kind: 'saved', s })),
    ...items.map((p): Option => ({ kind: 'result', p })),
  ];

  function choose(o: Option) {
    if (o.kind === 'loc') useMyLocation();
    else if (o.kind === 'result') pick(o.p);
    else if (o.s.point) pick(savedToPlace(o.s));
    else {
      close();
      onSetSaved(o.s);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const n = options.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % n);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a <= 0 ? n - 1 : a - 1));
    } else if (e.key === 'Enter') {
      if (active >= 0 && options[active]) choose(options[active]);
      else if (typing && options[1]) choose(options[1]);
      else if (waypoint.place) close();
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  function onBlur() {
    setOpen(false);
    // Typed text that was never confirmed reverts to the selected place.
    if (waypoint.place && waypoint.text !== waypoint.place.label) onText(waypoint.place.label);
  }

  return (
    <div className="place-input">
      <input
        ref={inputRef}
        value={waypoint.text}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value;
          setActive(-1);
          setOpen(true);
          // Typing a saved place's name ("Home", "Work", ...) puts its location in right away.
          const hit = exactSaved(saved, v);
          if (hit) {
            onPlace(savedToPlace(hit));
            search('');
            return;
          }
          onText(v);
          if (!v) onPlace(null);
          search(v);
        }}
        onFocus={(e) => {
          e.target.select();
          setOpen(true);
        }}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        spellCheck={false}
      />
      {open && (
        <ul className="suggestions" onMouseDown={(e) => e.preventDefault()}>
          {options.map((o, i) => {
            const cls = active === i ? 'active' : '';
            if (o.kind === 'loc')
              return (
                <li key="loc" className={cls} onClick={() => choose(o)}>
                  <Icon name="myLocation" size={20} className="sg-ic loc" />
                  <div>
                    <div className="sg-name">Your location</div>
                    {geoError && <div className="sg-detail err">{geoError}</div>}
                  </div>
                </li>
              );
            if (o.kind === 'saved')
              return (
                <li key={`s-${o.s.id}`} className={`${cls} sg-saved`} onClick={() => choose(o)}>
                  <span className={`sg-saved-ic sg-saved-${o.s.kind}`}>
                    <Icon name={savedIconName(o.s.kind)} size={16} />
                  </span>
                  <div>
                    <div className="sg-name">{o.s.name}</div>
                    <div className="sg-detail">{o.s.point ? o.s.address || 'Saved place' : 'Set location on the map'}</div>
                  </div>
                </li>
              );
            const p = o.p;
            return (
              <li key={`${p.lat},${p.lon},${i}`} className={cls} onClick={() => choose(o)}>
                <Icon name="place" size={20} className="sg-ic" />
                <div>
                  <div className="sg-name">{p.name ?? p.label}</div>
                  {p.detail && <div className="sg-detail">{p.detail}</div>}
                </div>
              </li>
            );
          })}
          {loading && <li className="sg-status">Searching…</li>}
          {!loading && typing && text.trim().length >= 2 && options.length === 1 && <li className="sg-status">No places found</li>}
        </ul>
      )}
    </div>
  );
}
