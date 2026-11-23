import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icons';

/** Length of the closing animation (keep in sync with `.closing` in styles.css). */
const CLOSE_MS = 160;

/**
 * Closing with an animation: `close()` plays it, then calls `onClose` (or `then`, e.g. to start choosing
 * a place on the map once the modal is gone). Escape closes too.
 */
export function useModalClose(onClose: () => void) {
  const [closing, setClosing] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function close(then: () => void = onClose) {
    if (closing) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return then();
    setClosing(true);
    timer.current = window.setTimeout(then, CLOSE_MS);
  }

  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return { closing, close };
}

interface Props {
  id: string;
  title: string;
  closing: boolean;
  onClose(): void;
  children: ReactNode;
}

/** Dialog with a fixed header and a scrolling body; animated in by CSS, out via `useModalClose`. */
export function Modal({ id, title, closing, onClose, children }: Props) {
  return (
    <div className={`modal-backdrop${closing ? ' closing' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className="modal-head">
          <h2 id={id}>{title}</h2>
          <button className="icon-btn" title="Close" onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
