import { useState } from 'react';
import { normName, type SavedPlace } from '../savedPlaces';
import { Icon, savedIconName } from './Icons';

export interface SavedPlacesActions {
  /** Choose the location of an existing saved place on the map. */
  onPick(s: SavedPlace): void;
  /** Choose the location of a new custom place with this name on the map. */
  onPickNew(name: string): void;
  onRemove(s: SavedPlace): void;
}

/** "Your locations" in the settings: Home and Work (unset until chosen), then the user's own places. */
export function SavedPlacesSection({ saved, onPick, onPickNew, onRemove }: { saved: SavedPlace[] } & SavedPlacesActions) {
  const [name, setName] = useState('');

  const trimmed = name.trim();
  const taken = !!trimmed && saved.some((s) => normName(s.name) === normName(trimmed));
  const canAdd = !!trimmed && !taken;

  return (
    <>
      <p className="saved-hint">Type a location's name (e.g. “Home”) in any search box to use it instantly.</p>

      <ul className="saved-list">
        {saved.map((s) => (
          <li key={s.id}>
            <span className={`sg-saved-ic sg-saved-${s.kind}`}>
              <Icon name={savedIconName(s.kind)} size={16} />
            </span>
            <div className="saved-text">
              <b>{s.name}</b>
              <small className={s.point ? '' : 'unset'}>
                {s.point ? s.address || `${s.point.lat.toFixed(5)}, ${s.point.lon.toFixed(5)}` : 'Not set'}
              </small>
            </div>
            <button className="saved-btn" onClick={() => onPick(s)} title="Choose the location on the map">
              {s.point ? 'Change' : 'Choose on map'}
            </button>
            {(s.point || s.kind === 'custom') && (
              <button className="icon-btn" title={s.kind === 'custom' ? 'Delete' : 'Clear'} onClick={() => onRemove(s)}>
                <Icon name="delete" size={20} />
              </button>
            )}
          </li>
        ))}
      </ul>

      <form
        className="saved-add"
        onSubmit={(e) => {
          e.preventDefault();
          if (canAdd) onPickNew(trimmed);
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New location name, e.g. Gym" maxLength={40} spellCheck={false} />
        <button type="submit" className="saved-btn primary" disabled={!canAdd}>
          Choose on map
        </button>
      </form>
      {taken && <div className="saved-err">A location with this name already exists</div>}
    </>
  );
}
