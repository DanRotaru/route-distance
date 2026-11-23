import {
  formatClock,
  formatDistance,
  formatDuration,
  formatPace,
  formatSpeedUnit,
  requiredSpeed,
  roundSpeed,
  travelSeconds,
  type Units,
} from '../format';
import type { Mode } from '../modes';
import type { CalcMode, ProfileState } from '../types';
import { Icon, ModeIcon } from './Icons';

interface Props {
  state: ProfileState;
  mode: Mode;
  calc: CalcMode;
  speed: number;
  targetMin: number;
  units: Units;
  departMs: number;
  selected: number;
  onSelect(i: number): void;
  onDetails(): void;
  onUseSpeed(kmh: number): void;
}

export function RouteList({ state, mode, calc, speed, targetMin, units, departMs, selected, onSelect, onDetails, onUseSpeed }: Props) {
  const { routes, status } = state;

  if (status === 'error') return <div className="empty err">{state.error}</div>;
  if (status === 'loading' && !routes.length) {
    return (
      <div className="routes">
        {[0, 1].map((i) => (
          <div key={i} className="route-card skeleton">
            <div />
            <div />
          </div>
        ))}
      </div>
    );
  }
  if (!routes.length) {
    return (
      <div className="empty">
        Pick a start and a destination — type an address or click on the map. Right-click the map for more options.
      </div>
    );
  }

  const targetSec = targetMin * 60;
  const shortest = routes.reduce((best, r, i) => (r.distance < routes[best].distance ? i : best), 0);

  return (
    <div className={`routes${status === 'loading' ? ' stale' : ''}`}>
      {routes.map((r, i) => {
        const isSel = i === selected;
        const userSec = travelSeconds(r.distance, speed);
        const req = requiredSpeed(r.distance, targetSec);
        const osmKmh = r.duration > 0 ? requiredSpeed(r.distance, r.duration) : 0;
        const tags: string[] = [];
        if (routes.length > 1 && i === 0) tags.push('Fastest by OSM road speeds');
        if (routes.length > 1 && i === shortest) tags.push('Shortest distance');

        return (
          <div
            key={i}
            className={`route-card${isSel ? ' selected' : ''}`}
            onClick={() => onSelect(i)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onSelect(i)}
          >
            <div className="rc-icon">
              <ModeIcon mode={mode.id} />
            </div>
            <div className="rc-main">
              <div className="rc-title">via {r.summary}</div>
              {tags.length > 0 && <div className="rc-tags">{tags.join(' · ')}</div>}

              {calc === 'speed' ? (
                <div className="rc-line">
                  at <b>{formatSpeedUnit(speed, units)}</b>
                  {mode.pace && <> ({formatPace(speed, units)})</>} · arrive <b>{formatClock(departMs + userSec * 1000)}</b>
                </div>
              ) : (
                <>
                  <div className="rc-line">
                    to arrive in <b>{targetMin} min</b> (by {formatClock(departMs + targetSec * 1000)})
                    {mode.pace && <> · pace {formatPace(req, units)}</>}
                  </div>
                  {req > mode.typicalMax && (
                    <div className="rc-warn">
                      <Icon name="warning" size={16} /> Faster than typical for {mode.label.toLowerCase()}
                    </div>
                  )}
                </>
              )}

              <div className="rc-osm">
                OSM estimate {formatDuration(r.duration)} = avg <b>{formatSpeedUnit(osmKmh, units)}</b>
              </div>

              {isSel && (
                <div className="rc-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="link-btn" onClick={onDetails}>
                    Details
                  </button>
                  {calc === 'speed' ? (
                    <button className="link-btn" onClick={() => onUseSpeed(roundSpeed(osmKmh, units))}>
                      Use OSM speed ({formatSpeedUnit(osmKmh, units)})
                    </button>
                  ) : (
                    <button className="link-btn" onClick={() => onUseSpeed(roundSpeed(req, units))}>
                      Set {formatSpeedUnit(req, units)} as my speed
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="rc-right">
              <div className="rc-big">{calc === 'speed' ? formatDuration(userSec) : formatSpeedUnit(req, units)}</div>
              <div className="rc-dist">{formatDistance(r.distance, units)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
