import { useEffect, useState } from 'react';
import { formatPace, fromDisplaySpeed, speedUnit, toDisplaySpeed, type Units } from '../format';
import type { Mode } from '../modes';
import type { CalcMode } from '../types';
import { Icon, ModeIcon } from './Icons';

interface NumberFieldProps {
  value: number;
  unit: string;
  step: number;
  min: number;
  max: number;
  label: string;
  onChange(v: number): void;
}

function NumberField({ value, unit, step, min, max, label, onChange }: NumberFieldProps) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft((d) => (parseFloat(d.replace(',', '.')) === value ? d : String(value)));
  }, [value]);
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));

  return (
    <div className="num-field">
      <button className="icon-btn" aria-label={`Decrease ${label}`} onClick={() => onChange(clamp(value - step))}>
        <Icon name="minus" size={20} />
      </button>
      <input
        aria-label={label}
        inputMode="decimal"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          const v = parseFloat(e.target.value.replace(',', '.'));
          if (v > 0) onChange(Math.min(v, max));
        }}
        onBlur={() => setDraft(String(value))}
        onFocus={(e) => e.target.select()}
      />
      <span className="unit">{unit}</span>
      <button className="icon-btn" aria-label={`Increase ${label}`} onClick={() => onChange(clamp(value + step))}>
        <Icon name="plus" size={20} />
      </button>
    </div>
  );
}

const TARGET_PRESETS = [5, 10, 15, 20, 30, 45, 60, 90];

interface Props {
  mode: Mode;
  calc: CalcMode;
  /** km/h */
  speed: number;
  targetMin: number;
  units: Units;
  onCalc(c: CalcMode): void;
  onSpeed(v: number): void;
  onTarget(v: number): void;
}

export function SpeedPanel({ mode, calc, speed, targetMin, units, onCalc, onSpeed, onTarget }: Props) {
  // The speed is stored in km/h; the field, slider and presets work in the user's unit.
  const range = units === 'imperial' ? mode.mph : mode;
  const shown = Math.round(toDisplaySpeed(speed, units) * 10) / 10;
  const setShown = (v: number) => onSpeed(fromDisplaySpeed(v, units));
  return (
    <section className="speed-card">
      <div className="seg" role="tablist">
        <button role="tab" aria-selected={calc === 'speed'} className={calc === 'speed' ? 'on' : ''} onClick={() => onCalc('speed')}>
          <Icon name="speed" size={18} />
          I'll go at a speed
        </button>
        <button role="tab" aria-selected={calc === 'time'} className={calc === 'time' ? 'on' : ''} onClick={() => onCalc('time')}>
          <Icon name="schedule" size={18} />
          I need to arrive in
        </button>
      </div>

      {calc === 'speed' ? (
        <>
          <div className="speed-row">
            <span className="speed-mode">
              <ModeIcon mode={mode.id} size={22} />
            </span>
            <NumberField
              value={shown}
              unit={speedUnit(units)}
              step={range.step}
              min={range.min}
              max={units === 'imperial' ? 190 : 300}
              label="speed"
              onChange={setShown}
            />
            {mode.pace && <span className="pace">{formatPace(speed, units)}</span>}
          </div>
          <input
            className="slider"
            type="range"
            min={range.min}
            max={range.max}
            step={range.step}
            value={Math.min(shown, range.max)}
            onChange={(e) => setShown(Number(e.target.value))}
            aria-label="Speed slider"
          />
          <div className="chips">
            {range.presets.map((p) => (
              <button key={p} className={`chip${p === shown ? ' on' : ''}`} onClick={() => setShown(p)}>
                {p}
              </button>
            ))}
          </div>
          <p className="hint">
            Your average {mode.label.toLowerCase()} speed, stops included. Every time shown is <b>distance ÷ this speed</b>.
          </p>
        </>
      ) : (
        <>
          <div className="speed-row">
            <span className="speed-mode">
              <Icon name="flag" size={22} />
            </span>
            <NumberField value={targetMin} unit="min" step={1} min={1} max={6000} label="minutes" onChange={onTarget} />
          </div>
          <div className="chips">
            {TARGET_PRESETS.map((p) => (
              <button key={p} className={`chip${p === targetMin ? ' on' : ''}`} onClick={() => onTarget(p)}>
                {p < 60 ? `${p} min` : `${p / 60} h`}
              </button>
            ))}
          </div>
          <p className="hint">Each route shows the average speed you need to hold to get there in time.</p>
        </>
      )}
    </section>
  );
}
