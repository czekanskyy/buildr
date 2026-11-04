import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * How many steps of collapsing (0..`max`) the toolbar needs to fit its row. It measures the row
 * itself with a `ResizeObserver`, not the window, because the editor may be embedded in a box of
 * any width. A step is taken when the content overflows; it is undone once the row is as wide as
 * the content was when that step was taken. A zone (`.bd-toolbar-cluster`) that is wider than its grid
 * track counts as overflow too, since the tracks are equal and a full zone would otherwise overlap.
 */
export function useOverflowLevel(ref: RefObject<HTMLElement | null>, max: number): number {
  const [level, setLevel] = useState(0);
  // The content width at which each level overflowed, to know when it fits again.
  const needed = useRef<number[]>([]);

  const measure = () => {
    const el = ref.current;
    if (el === null) return;
    const room = el.clientWidth;
    let zones = 0;
    for (const zone of el.querySelectorAll<HTMLElement>('.bd-toolbar-cluster')) {
      zones += Math.max(0, zone.scrollWidth - zone.clientWidth);
    }
    const width = Math.max(el.scrollWidth, room + zones);
    if (width > room + 1 && level < max) {
      needed.current[level] = width;
      setLevel(level + 1);
      return;
    }
    const previous = needed.current[level - 1];
    if (level > 0 && previous !== undefined && room >= previous) setLevel(level - 1);
  };

  const latest = useRef(measure);
  latest.current = measure;

  // Every commit: a new level, a longer title or a picker that appeared can all change the width.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `measure` is redefined each render on purpose
  useLayoutEffect(measure);

  useEffect(() => {
    const el = ref.current;
    if (el === null || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => latest.current());
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return level;
}
