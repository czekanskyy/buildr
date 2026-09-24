import type { NodeStyles } from '../document/style-types.ts';
import type { Theme } from './theme.ts';

/**
 * Memoizes per-node work on the identity of the `NodeStyles` object and the theme (docs/styles.md
 * #css-strategy: "a per-node rule cache, a WeakMap keyed on node.styles identity"). The document
 * is immutable, so an unchanged node keeps the same `styles` object across edits and its CSS is
 * not recomputed; entries disappear with the objects they are keyed on. This is memoization, not
 * shared state — a hit and a miss always return equal results.
 */
export type StylesMemo = <T>(theme: Theme, styles: NodeStyles, compute: () => T) => T;

/** A separate cache, so two computations keyed on the same `styles` never see each other's entries. */
export function createStylesMemo(): StylesMemo {
  const caches = new WeakMap<Theme, WeakMap<NodeStyles, unknown>>();
  return (theme, styles, compute) => {
    let perTheme = caches.get(theme);
    if (perTheme === undefined) {
      perTheme = new WeakMap();
      caches.set(theme, perTheme);
    }
    if (perTheme.has(styles)) return perTheme.get(styles) as ReturnType<typeof compute>;
    const value = compute();
    perTheme.set(styles, value);
    return value;
  };
}

export const memoizeByStyles: StylesMemo = createStylesMemo();
