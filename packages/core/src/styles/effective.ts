import type { NodeStyles } from '../document/style-types.ts';
import { BOX_SIDES, CORNERS, STYLE_GROUPS, stylePropertyRegistry } from './properties.ts';
import type { Breakpoint } from './theme.ts';

/** Where an effective value comes from: `'base'` (desktop) or the id of the breakpoint that set it. */
export type StyleSource = 'base' | (string & {});

export interface EffectiveValue {
  readonly value: string | number | boolean;
  /** The layer that set it. Equal to the requested breakpoint when the node overrides it there. */
  readonly source: StyleSource;
}

/**
 * The effective style of a node at one breakpoint, keyed by property path: `layout.gap`, and for
 * per-side / per-corner properties one entry per side (`spacing.margin.top`,
 * `border.radius.topLeft`). A property nobody sets has no entry.
 */
export type EffectiveStyles = Readonly<Record<string, EffectiveValue>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function own(object: unknown, key: string): unknown {
  return isRecord(object) && Object.hasOwn(object, key) ? object[key] : undefined;
}

/** The layers that apply at `bp`, widest first: `base`, then every breakpoint down to `bp`. */
function cascade(bp: string, breakpoints: readonly Breakpoint[]): string[] {
  const layers = ['base'];
  if (bp === 'base') return layers;
  const index = breakpoints.findIndex((b) => b.id === bp);
  if (index === -1) return layers;
  for (const b of breakpoints.slice(0, index + 1)) layers.push(b.id);
  return layers;
}

function layerDecl(styles: NodeStyles, layer: string): unknown {
  return layer === 'base' ? own(styles, 'base') : own(own(styles, 'bp'), layer);
}

const isValue = (value: unknown): value is string | number | boolean =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

/** The property paths a group/property contributes (one, or one per side/corner). */
function paths(group: string, name: string, shape: string): string[] {
  const base = `${group}.${name}`;
  if (shape === 'box') return BOX_SIDES.map((side) => `${base}.${side}`);
  if (shape === 'corners') return CORNERS.map((corner) => `${base}.${corner}`);
  return [base];
}

/**
 * What the inspector shows for a node at a breakpoint (docs/responsive.md): the value of every
 * property that is set on the way down from desktop, with the layer it came from — the effective
 * value is `merge(base, tablet, mobile)`, each narrower layer overriding the wider ones. Removing
 * a key at a breakpoint ("reset") makes it fall back to the widest layer that still sets it.
 * `breakpoints` are the theme's, widest first; an unknown id sees only `base`. Never throws.
 */
export function effectiveStyles(
  styles: NodeStyles,
  bp: string,
  breakpoints: readonly Breakpoint[],
): EffectiveStyles {
  const out: Record<string, EffectiveValue> = {};
  const layers = cascade(bp, breakpoints).map((layer) => ({
    layer,
    decl: layerDecl(styles, layer),
  }));
  for (const group of STYLE_GROUPS) {
    for (const def of Object.values(stylePropertyRegistry)) {
      if (def.group !== group) continue;
      for (const path of paths(group, def.name, def.shape)) {
        const keys = path.split('.');
        for (const { layer, decl } of layers) {
          let value: unknown = decl;
          for (const key of keys) value = own(value, key);
          if (isValue(value)) out[path] = { value, source: layer };
        }
      }
    }
  }
  return Object.freeze(out);
}

/** The effective value of one property path (`layout.gap`), or `undefined` when nothing sets it. */
export function effectiveStyle(
  styles: NodeStyles,
  bp: string,
  breakpoints: readonly Breakpoint[],
  path: string,
): EffectiveValue | undefined {
  const all = effectiveStyles(styles, bp, breakpoints);
  return Object.hasOwn(all, path) ? all[path] : undefined;
}

/**
 * Whether the node sets anything at exactly this layer (`'base'` or a breakpoint id) — what the
 * layers panel uses to mark a node as overridden at the current breakpoint.
 */
export function hasOverrides(styles: NodeStyles, bp: string): boolean {
  const decl = layerDecl(styles, bp);
  return Object.values(stylePropertyRegistry).some((def) =>
    paths(def.group, def.name, def.shape).some((path) => {
      let value: unknown = decl;
      for (const key of path.split('.')) value = own(value, key);
      return isValue(value);
    }),
  );
}
