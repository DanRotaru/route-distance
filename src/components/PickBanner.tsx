import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { searchPlaces } from '../api';
import type { SavedPlace } from '../savedPlaces';
import type { LatLon, Place } from '../types';
import { Icon, savedIconName } from './Icons';

interface Props {
  place: SavedPlace;
  getBias(): LatLon | undefined;
  /** A search result was chosen (clicking the map is handled by the map itself). */
  onFound(p: Place): void;
  onCancel(): void;
}

/** Shown over the map while choosing a saved place's location: click the map, or search an address. */
export function PickBanner({ place, getBias, onFound, onCancel }: Props) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Place[]>([]);
  const [active, setActive] = useState(-1);
  const [status, setStatus] = useState<'idle' | 'loading' | 'empty' | 'error'>('idle');
  const timer = useRef<number | undefined>(undefined);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => () => {
    clearTimeout(timer.current);
    ctrl.current?.abort();
  }, []);

  function search(text: string) {
    clearTimeout(timer.current);
    ctrl.current?.abort();
    setActive(-1);
    if (text.trim().length < 2) {
      setItems([]);
      setStatus('idle');
      return;
    }
    setStatus('loading');
    timer.current = window.setTimeout(() => {
      const c = new AbortController();
      ctrl.current = c;
      searchPlaces(text, getBias(), c.signal)
        .then((r) => {
          setItems(r);
          setStatus(r.length ? 'idle' : 'empty');
        })
        .catch(() => !c.signal.aborted && setStatus('error'));
    }, 300);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' && items.length) {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === 'ArrowUp' && items.length) {
      e.preventDefault();
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === 'Enter') {
      const p = items[active >= 0 ? active : 0];
      if (p) onFound(p);
    }
  }

  return (
    <div className="pick-banner">
      <div className="pick-head">
        <span className={`sg-saved-ic sg-saved-${place.kind}`}>
          <Icon name={savedIconName(place.kind)} size={16} />
        </span>
        <span className="pick-title">
          Set <b>{place.name}</b>: click on the map or search
        </span>
        <button className="pick-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <div className="place-input">
        <input
          autoFocus
          value={q}
          placeholder="Search an address"
          spellCheck={false}
          onChange={(e) => {
            setQ(e.target.value);
            search(e.target.value);
          }}
          onKeyDown={onKeyDown}
        />
        {(items.length > 0 || status !== 'idle') && (
          <ul className="suggestions" onMouseDown={(e) => e.preventDefault()}>
            {items.map((p, i) => (
              <li key={`${p.lat},${p.lon},${i}`} className={active === i ? 'active' : ''} onClick={() => onFound(p)}>
                <Icon name="place" size={20} className="sg-ic" />
                <div>
                  <div className="sg-name">{p.name ?? p.label}</div>
                  {p.detail && <div className="sg-detail">{p.detail}</div>}
                </div>
              </li>
            ))}
            {status === 'loading' && <li className="sg-status">Searching…</li>}
            {status === 'empty' && <li className="sg-status">No places found</li>}
            {status === 'error' && <li className="sg-status">Search is unavailable</li>}
          </ul>
        )}
      </div>
    </div>
  );
}
