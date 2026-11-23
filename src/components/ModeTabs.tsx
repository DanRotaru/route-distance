import { MODES, type ModeId } from '../modes';
import { Icon, ModeIcon } from './Icons';

interface Props {
  modeId: ModeId;
  /** Per-mode value shown under the icon (time or required speed); empty shows the mode name. */
  values: string[];
  onMode(id: ModeId): void;
  /** Tooltip of the close button (it clears the route, or hides the panel when there is nothing to clear). */
  clearTitle: string;
  onClear(): void;
}

export function ModeTabs({ modeId, values, clearTitle, onMode, onClear }: Props) {
  return (
    <div className="modes">
      <div className="mode-list" role="tablist">
        {MODES.map((m, i) => (
          <button
            key={m.id}
            role="tab"
            aria-selected={m.id === modeId}
            className={`mode${m.id === modeId ? ' on' : ''}`}
            title={m.label}
            onClick={() => onMode(m.id)}
          >
            <span className="mode-pill">
              <ModeIcon mode={m.id} />
            </span>
            <span className="mode-val">{values[i] || m.short}</span>
          </button>
        ))}
      </div>
      <button className="icon-btn" title={clearTitle} onClick={onClear}>
        <Icon name="close" />
      </button>
    </div>
  );
}
