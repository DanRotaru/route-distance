import type { SavedPlace } from '../savedPlaces';
import type { LatLon, Place, Waypoint } from '../types';
import { Icon } from './Icons';
import { PlaceInput } from './PlaceInput';

export const MAX_WAYPOINTS = 10;

interface Props {
  waypoints: Waypoint[];
  focusId: string | null;
  saved: SavedPlace[];
  onSetSaved(s: SavedPlace, waypointId: string): void;
  getBias(): LatLon | undefined;
  onText(id: string, text: string): void;
  onPlace(id: string, place: Place | null): void;
  onRemove(id: string): void;
  onSwap(): void;
  onAdd(): void;
}

export function WaypointList({ waypoints, focusId, saved, onSetSaved, getBias, onText, onPlace, onRemove, onSwap, onAdd }: Props) {
  const n = waypoints.length;
  return (
    <div className="wps">
      <div className="wp-rows">
        {waypoints.map((w, i) => {
          const isFirst = i === 0;
          const isLast = i === n - 1;
          return (
            <div className="wp-row" key={w.id}>
              <div className={`wp-icon${isLast ? '' : ' dots'}`}>
                {isFirst ? (
                  <span className="dot-origin" />
                ) : isLast ? (
                  <Icon name="place" size={22} className="ic-dest" />
                ) : (
                  <span className="dot-stop">{i}</span>
                )}
              </div>
              <PlaceInput
                waypoint={w}
                placeholder={isFirst ? 'Choose starting point, or click on the map' : isLast ? 'Choose destination' : 'Add a stop'}
                autoFocus={w.id === focusId}
                saved={saved}
                onSetSaved={(s) => onSetSaved(s, w.id)}
                getBias={getBias}
                onText={(t) => onText(w.id, t)}
                onPlace={(p) => onPlace(w.id, p)}
              />
              <div className="wp-action">
                {n > 2 && (
                  <button className="icon-btn" title="Remove" onClick={() => onRemove(w.id)}>
                    <Icon name="close" size={20} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {n === 2 && (
          <button className="icon-btn swap" title="Reverse starting point and destination" onClick={onSwap}>
            <Icon name="swap" />
          </button>
        )}
      </div>
      {n < MAX_WAYPOINTS && (
        <button className="add-dest" onClick={onAdd}>
          <Icon name="addCircle" />
          <span>Add destination</span>
        </button>
      )}
    </div>
  );
}
