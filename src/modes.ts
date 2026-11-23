/** Routing profiles served by routing.openstreetmap.de (OSRM). */
export type Profile = 'car' | 'bike' | 'foot';
export const PROFILES: Profile[] = ['car', 'bike', 'foot'];

export type ModeId = 'car' | 'moto' | 'bike' | 'run' | 'walk';

export interface Mode {
  id: ModeId;
  label: string;
  short: string;
  profile: Profile;
  /** Speeds in km/h. */
  defaultSpeed: number;
  min: number;
  max: number;
  step: number;
  presets: number[];
  /** Above this a required speed is flagged as unrealistic for the mode. */
  typicalMax: number;
  /** Show pace (min/km) next to speed. */
  pace?: boolean;
  /** Speed input in mph for imperial units: range and presets that are round numbers in mph. */
  mph: { min: number; max: number; step: number; presets: number[] };
}

export const MODES: Mode[] = [
  { id: 'car', label: 'Car', short: 'Car', profile: 'car', defaultSpeed: 40, min: 5, max: 160, step: 1, presets: [30, 40, 50, 60, 90, 110], typicalMax: 130, mph: { min: 3, max: 100, step: 1, presets: [20, 25, 30, 40, 55, 70] } },
  { id: 'moto', label: 'Motorcycle', short: 'Moto', profile: 'car', defaultSpeed: 45, min: 5, max: 160, step: 1, presets: [30, 45, 60, 80, 100], typicalMax: 130, mph: { min: 3, max: 100, step: 1, presets: [20, 30, 40, 50, 65] } },
  { id: 'bike', label: 'Bicycle', short: 'Bike', profile: 'bike', defaultSpeed: 16, min: 3, max: 50, step: 0.5, presets: [10, 14, 16, 20, 25, 30], typicalMax: 35, mph: { min: 2, max: 30, step: 0.5, presets: [6, 8, 10, 12, 15, 20] } },
  { id: 'run', label: 'Running', short: 'Run', profile: 'foot', defaultSpeed: 10, min: 4, max: 25, step: 0.5, presets: [8, 9, 10, 11, 12, 14], typicalMax: 18, pace: true, mph: { min: 2.5, max: 15, step: 0.5, presets: [5, 5.5, 6, 7, 8, 9] } },
  { id: 'walk', label: 'Walking', short: 'Walk', profile: 'foot', defaultSpeed: 5, min: 1, max: 10, step: 0.5, presets: [3, 4, 4.5, 5, 5.5, 6], typicalMax: 7, pace: true, mph: { min: 0.5, max: 6, step: 0.5, presets: [2, 2.5, 3, 3.5, 4] } },
];

export const MODE_BY_ID = Object.fromEntries(MODES.map((m) => [m.id, m])) as Record<ModeId, Mode>;

export const isModeId = (v: unknown): v is ModeId => MODES.some((m) => m.id === v);

export const defaultSpeeds = () =>
  Object.fromEntries(MODES.map((m) => [m.id, m.defaultSpeed])) as Record<ModeId, number>;
