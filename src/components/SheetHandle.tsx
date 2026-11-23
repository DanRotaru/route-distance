import { useRef } from 'react';

interface Props {
  /** Current sheet height in px, or null for the CSS default. */
  height: number | null;
  onHeight(h: number): void;
  onDragging(d: boolean): void;
}

/** Smallest sheet height (mode tabs stay visible) and the map strip always left above the sheet. */
const MIN_H = 96;
const MAP_MIN = 72;

const maxH = () => window.innerHeight - MAP_MIN;
const clamp = (h: number) => Math.max(MIN_H, Math.min(maxH(), h));
const snaps = () => [MIN_H, Math.round(window.innerHeight * 0.5), maxH()];

/** Drag handle for the mobile bottom sheet: drag to resize, tap to cycle small / half / full. */
export function SheetHandle({ height, onHeight, onDragging }: Props) {
  const drag = useRef<{ startY: number; startH: number; moved: boolean } | null>(null);

  function currentHeight(el: HTMLElement) {
    return height ?? el.closest('.sidebar')!.getBoundingClientRect().height;
  }

  return (
    <div
      className="sheet-handle"
      role="slider"
      aria-label="Resize panel"
      aria-orientation="vertical"
      aria-valuemin={MIN_H}
      aria-valuemax={maxH()}
      aria-valuenow={Math.round(height ?? 0)}
      tabIndex={0}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { startY: e.clientY, startH: currentHeight(e.currentTarget), moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dy = d.startY - e.clientY;
        if (!d.moved && Math.abs(dy) < 4) return;
        if (!d.moved) onDragging(true);
        d.moved = true;
        onHeight(clamp(d.startH + dy));
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        drag.current = null;
        if (!d) return;
        if (d.moved) {
          onDragging(false);
          return;
        }
        // Tap: jump to the next snap point above the current height (wrapping to the smallest).
        const h = currentHeight(e.currentTarget);
        const next = snaps().find((s) => s > h + 8) ?? MIN_H;
        onHeight(next);
      }}
      onPointerCancel={() => {
        if (drag.current?.moved) onDragging(false);
        drag.current = null;
      }}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        const h = currentHeight(e.currentTarget);
        onHeight(clamp(h + (e.key === 'ArrowUp' ? 48 : -48)));
      }}
    >
      <span className="sheet-grip" />
    </div>
  );
}
