import { formatClock, formatDistance, formatDuration, formatShortDuration, formatSpeedUnit, instruction, travelSeconds, type Units } from '../format';
import type { Route } from '../types';
import { Icon, TurnIcon } from './Icons';

interface Props {
  route: Route;
  /** Effective average speed for this route (user speed, or the speed required to arrive in time). */
  kmh: number;
  departMs: number;
  units: Units;
  stopLabels: string[];
  onBack(): void;
}

export function RouteDetails({ route, kmh, departMs, units, stopLabels, onBack }: Props) {
  const totalSec = travelSeconds(route.distance, kmh);
  let elapsed = 0;

  return (
    <div className="details">
      <button className="back-btn" onClick={onBack}>
        <Icon name="arrowBack" size={20} /> All routes
      </button>
      <div className="dt-head">
        <div className="dt-title">via {route.summary}</div>
        <div className="dt-sum">
          <span className="rc-big">{formatDuration(totalSec)}</span>
          <span className="dt-dist">({formatDistance(route.distance, units)})</span>
        </div>
        <div className="rc-line">
          at an average of <b>{formatSpeedUnit(kmh, units)}</b> · arrive <b>{formatClock(departMs + totalSec * 1000)}</b>
        </div>
      </div>
      <ol className="steps">
        {route.steps.map((s, k) => {
          const stepSec = travelSeconds(s.distance, kmh);
          const at = elapsed;
          elapsed += stepSec;
          if (s.type === 'depart' && s.legIndex > 0) return null;
          return [
            k === 0 && (
              <li key="start" className="leg-head">
                <span className="dot-origin" />
                <span>{stopLabels[0]}</span>
                <span className="leg-time">{formatClock(departMs + at * 1000)}</span>
              </li>
            ),
            <li key={k} className="step">
              <span className="step-ic">
                <TurnIcon step={s} />
              </span>
              <div className="step-body">
                <div className="step-text">{instruction(s, route.legCount)}</div>
                {s.type === 'arrive' ? (
                  <div className="step-meta">
                    {stopLabels[s.legIndex + 1]} · {formatClock(departMs + at * 1000)}
                  </div>
                ) : (
                  s.distance > 0 && (
                    <div className="step-meta">
                      {formatDistance(s.distance, units)} · {formatShortDuration(stepSec)}
                    </div>
                  )
                )}
              </div>
            </li>,
          ];
        })}
      </ol>
    </div>
  );
}
