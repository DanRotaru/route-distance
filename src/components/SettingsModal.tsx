import type { Units } from '../format';
import type { SavedPlace } from '../savedPlaces';
import type { MapImagery, MapSettings, Theme } from '../settings';
import { Modal, useModalClose } from './Modal';
import { SavedPlacesSection, type SavedPlacesActions } from './SavedPlacesSection';

interface Option<T> {
  value: T;
  title: string;
  hint: string;
}

const UNITS: Option<Units>[] = [
  { value: 'metric', title: 'Metric', hint: 'km, m and km/h' },
  { value: 'imperial', title: 'Imperial', hint: 'mi, ft and mph' },
];

const THEMES: Option<Theme>[] = [
  { value: 'light', title: 'Light', hint: 'Always light' },
  { value: 'dark', title: 'Dark', hint: 'Always dark' },
  { value: 'system', title: 'System', hint: 'Match device' },
];

const IMAGERY: Option<MapImagery>[] = [
  { value: 'google', title: 'Google imagery', hint: 'Google street map and satellite tiles' },
  { value: 'default', title: 'Leaflet imagery', hint: 'OpenStreetMap street map, Esri satellite' },
];

function Choice<T extends string>(props: { name: string; options: Option<T>[]; value: T; row?: boolean; onChange(v: T): void }) {
  return (
    <div className={`choice-group${props.row ? ' row' : ''}`}>
      {props.options.map((o) => (
        <label key={o.value} className={`choice${props.value === o.value ? ' on' : ''}`}>
          <input type="radio" name={props.name} checked={props.value === o.value} onChange={() => props.onChange(o.value)} />
          <span>
            <b>{o.title}</b>
            <small>{o.hint}</small>
          </span>
        </label>
      ))}
    </div>
  );
}

interface Props extends SavedPlacesActions {
  settings: MapSettings;
  saved: SavedPlace[];
  onChange(s: MapSettings): void;
  onClose(): void;
}

export function SettingsModal({ settings, saved, onChange, onClose, onPick, onPickNew, onRemove }: Props) {
  const { closing, close } = useModalClose(onClose);

  return (
    <Modal id="settings-title" title="Settings" closing={closing} onClose={() => close()}>
      <section>
        <h3>Your locations</h3>
        <SavedPlacesSection
          saved={saved}
          onPick={(s) => close(() => onPick(s))}
          onPickNew={(name) => close(() => onPickNew(name))}
          onRemove={onRemove}
        />
      </section>

      <section>
        <h3>Appearance</h3>
        <Choice name="theme" row options={THEMES} value={settings.theme} onChange={(theme) => onChange({ ...settings, theme })} />
      </section>

      <section>
        <h3>Units</h3>
        <Choice name="units" row options={UNITS} value={settings.units} onChange={(units) => onChange({ ...settings, units })} />
      </section>

      <section>
        <h3>Map imagery</h3>
        <Choice name="imagery" options={IMAGERY} value={settings.imagery} onChange={(imagery) => onChange({ ...settings, imagery })} />
      </section>
    </Modal>
  );
}
