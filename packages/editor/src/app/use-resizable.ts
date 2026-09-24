import { type KeyboardEvent, type PointerEvent, useCallback, useRef, useState } from 'react';

export interface ResizableOptions {
  readonly initial: number;
  readonly min: number;
  readonly max: number;
  /** Which way dragging to the right moves the size: `1` for a panel on the left, `-1` on the right. */
  readonly direction: 1 | -1;
  /** How far an arrow key moves it. */
  readonly step?: number;
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
  };
  /** Sets the size, kept within its limits. */
  set(size: number): void;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The state and events of one splitter: drag it with a pointer, or move it with the arrow keys, Home and End. */
export function useResizable(options: ResizableOptions): Resizable {
  const { min, max, direction, step = 16 } = options;
  const [size, setSize] = useState(() => clamp(options.initial, min, max));
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; size: number } | null>(null);

  const set = useCallback((next: number) => setSize(clamp(next, min, max)), [min, max]);

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
  };

  return { size, dragging, bind, set };
}
