import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

export interface ResizableOptions {
  readonly initial: number;
  readonly min: number;
  readonly max: number;
  /** Which way dragging to the right moves the size: `1` for a panel on the left, `-1` on the right. */
  readonly direction: 1 | -1;
  /** How far an arrow key moves it. */
  readonly step?: number;
  /** Remembers the size in `localStorage` under this key (a failing storage is ignored). */
  readonly storageKey?: string;
}

export interface Resizable {
  readonly size: number;
  readonly dragging: boolean;
  readonly bind: {
    onPointerDown(event: PointerEvent<HTMLElement>): void;
    onPointerMove(event: PointerEvent<HTMLElement>): void;
    onPointerUp(event: PointerEvent<HTMLElement>): void;
    onPointerCancel(event: PointerEvent<HTMLElement>): void;
    onKeyDown(event: KeyboardEvent<HTMLElement>): void;
    onDoubleClick(event: MouseEvent<HTMLElement>): void;
  };
  /** Sets the size, kept within its limits. */
  set(size: number): void;
  /** Back to the initial size. */
  reset(): void;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function readStored(key: string | undefined): number | undefined {
  if (key === undefined) return undefined;
  try {
    const raw = window.localStorage.getItem(key);
    const value = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function writeStored(key: string, size: number): void {
  try {
    window.localStorage.setItem(key, String(size));
  } catch {
    // Storage is unavailable (private mode, quota): the size just is not remembered.
  }
}

/**
 * The state and events of one splitter: drag it with a pointer, or move it with the arrow keys,
 * Home and End; double-click puts it back to the initial size. The size can be remembered.
 */
export function useResizable(options: ResizableOptions): Resizable {
  const { min, max, direction, step = 16, storageKey } = options;
  const [size, setSize] = useState(() =>
    clamp(readStored(storageKey) ?? options.initial, min, max),
  );
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; size: number } | null>(null);
  const changed = useRef(false);

  const set = useCallback(
    (next: number) => {
      changed.current = true;
      setSize(clamp(next, min, max));
    },
    [min, max],
  );

  // Remember the size once a change is done (not on every pointer move, not on the first render).
  useEffect(() => {
    if (storageKey === undefined || dragging || !changed.current) return;
    writeStored(storageKey, size);
  }, [storageKey, size, dragging]);

  const bind: Resizable['bind'] = {
    onPointerDown(event) {
      event.currentTarget.setPointerCapture?.(event.pointerId);
      start.current = { x: event.clientX, size };
      setDragging(true);
    },
    onPointerMove(event) {
      const from = start.current;
      if (from === null) return;
      set(from.size + (event.clientX - from.x) * direction);
    },
    onPointerUp(event) {
      start.current = null;
      setDragging(false);
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    },
    onPointerCancel() {
      start.current = null;
      setDragging(false);
    },
    onKeyDown(event) {
      const grow = direction === 1 ? 'ArrowRight' : 'ArrowLeft';
      const shrink = direction === 1 ? 'ArrowLeft' : 'ArrowRight';
      if (event.key === grow) set(size + step);
      else if (event.key === shrink) set(size - step);
      else if (event.key === 'Home') set(min);
      else if (event.key === 'End') set(max);
      else return;
      event.preventDefault();
    },
    onDoubleClick() {
      set(options.initial);
    },
  };

  return { size, dragging, bind, set, reset: () => set(options.initial) };
}
