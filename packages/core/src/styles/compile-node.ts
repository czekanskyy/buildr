import type { NodeStyles, StyleState } from '../document/style-types.ts';
import type { NodeId } from '../document/types.ts';
import type { Diagnostic } from '../result/diagnostic.ts';
import { createStylesMemo, memoizeByStyles } from './cache.ts';
import {
  type MotionPlan,
  motionKeyframeNames,
  planMotion,
  renderMotion,
} from './compile-motion.ts';
import { parseStyleValue } from './grammar.ts';
import {
  BOX_SIDES,
  CORNERS,
  STYLE_GROUPS,
  type StylePropertyDef,
  stylePropertyRegistry,
} from './properties.ts';
import type { Theme } from './theme.ts';
import { resolveTokenRef } from './tokens.ts';

/** The pseudo-states in emission order. */
export const STYLE_STATES: readonly StyleState[] = ['hover', 'focus-visible', 'active'];

/** A node's styles as CSS declaration lists (no selector): `display: grid; gap: var(--b-space-8)`. */
export interface NodeDeclarations {
  /** Desktop, no media query. `undefined` when there is nothing to emit. */
  readonly base: string | undefined;
  readonly state: Readonly<Partial<Record<StyleState, string>>>;
  /** By breakpoint id, for the ids present on the node (whether the theme has them is the caller's concern). */
  readonly bp: Readonly<Record<string, string>>;
  /** Motion (ADR-027) as data, base and per breakpoint; rendered with a selector by `compileNodeRules`. */
  readonly motion: {
    readonly base: MotionPlan | undefined;
    readonly bp: Readonly<Record<string, MotionPlan>>;
  };
  /** Problems found while compiling; not yet tagged with a node. */
  readonly diagnostics: readonly Diagnostic[];
}

const EMPTY: NodeDeclarations = Object.freeze({
  base: undefined,
  state: Object.freeze({}),
  bp: Object.freeze({}),
  motion: Object.freeze({ base: undefined, bp: Object.freeze({}) }),
  diagnostics: Object.freeze([]),
});

/** A node's rules with the `.b-<id>` selector, ready to place in a stylesheet. */
export interface NodeRules {
  readonly base: string | undefined;
  readonly state: Readonly<Partial<Record<StyleState, string>>>;
  readonly bp: Readonly<Record<string, string>>;
  /** Motion rules (ADR-027): complete at-rule blocks, to place after the node's rules and inside its breakpoint's media query. */
  readonly motion: {
    readonly base: string | undefined;
    readonly bp: Readonly<Record<string, string>>;
  };
  /** The `@keyframes` names the node's motion rules use; `keyframesRule` gives each rule. */
  readonly keyframes: readonly string[];
  readonly diagnostics: readonly Diagnostic[];
}

const SAFE_NODE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** The class a node's rules are attached to. */
export function nodeClassName(id: NodeId): string {
  return `b-${id}`;
}

function own(object: object, key: string): unknown {
  return Object.hasOwn(object, key) ? (object as Record<string, unknown>)[key] : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const DEFS_BY_GROUP = STYLE_GROUPS.map((group) => ({
  group,
  defs: Object.values(stylePropertyRegistry).filter((def) => def.group === group),
}));

function warn(diagnostics: Diagnostic[], code: string, message: string, path: string): void {
  diagnostics.push({ code, message, severity: 'warning', details: { property: path } });
}

function compileValue(
  def: StylePropertyDef,
  cssProperty: string,
  value: unknown,
  path: string,
  theme: Theme,
  diagnostics: Diagnostic[],
  out: string[],
): void {
  const parsed = parseStyleValue(def.grammar, value, { inheritable: def.inheritable });
  if (!parsed.ok) {
    diagnostics.push({ ...parsed.error, details: { property: path } });
    return;
  }
  if (typeof value === 'string' && value.startsWith('$')) {
    const ref = resolveTokenRef(theme, value);
    if (!ref.ok) warn(diagnostics, 'style.unknown-token', ref.error.message, path);
  }
  // `hidden: false` compiles to nothing.
  if (parsed.value === '') return;
  out.push(`${cssProperty}: ${parsed.value}`);
}

const FILTER_FUNCTIONS = [
  ['blur', 'blur'],
  ['brightness', 'brightness'],
  ['contrast', 'contrast'],
  ['saturate', 'saturate'],
  ['grayscale', 'grayscale'],
  ['sepia', 'sepia'],
  ['hueRotate', 'hue-rotate'],
  ['invert', 'invert'],
] as const;
const TRANSFORM_FUNCTIONS = [
  ['translateX', 'translateX'],
  ['translateY', 'translateY'],
  ['rotate', 'rotate'],
  ['scale', 'scale'],
  ['skewX', 'skewX'],
  ['skewY', 'skewY'],
] as const;
const COMPOUND_NAMES: readonly string[] = [
  'shadowX',
  'shadowY',
  'shadowBlur',
  'shadowSpread',
  'shadowColor',
  'shadowInset',
  'textShadowX',
  'textShadowY',
  'textShadowBlur',
  'textShadowColor',
  'backdropBlur',
  ...FILTER_FUNCTIONS.map(([name]) => name),
  ...TRANSFORM_FUNCTIONS.map(([name]) => name),
];

/** One `StyleDecl` as a declaration list, in registry order so the output never depends on key order. */
function compileDecl(
  decl: unknown,
  statesOnly: boolean,
  where: string,
  theme: Theme,
  diagnostics: Diagnostic[],
): string | undefined {
  if (!isRecord(decl)) return undefined;
  const out: string[] = [];

  for (const key of Object.keys(decl)) {
    if (!(STYLE_GROUPS as readonly string[]).includes(key)) {
      warn(diagnostics, 'style.unknown-property', `unknown style group "${key}"`, `${where}${key}`);
    }
  }

  for (const { group, defs } of DEFS_BY_GROUP) {
    const groupValue = own(decl, group);
    if (groupValue === undefined) continue;
    if (!isRecord(groupValue)) {
      warn(diagnostics, 'style.invalid-value', `"${group}" must be an object`, `${where}${group}`);
      continue;
    }
    for (const key of Object.keys(groupValue)) {
      if (!defs.some((def) => def.name === key)) {
        warn(
          diagnostics,
          'style.unknown-property',
          `unknown style property "${group}.${key}"`,
          `${where}${group}.${key}`,
        );
      }
    }

    const compound = new Map<string, Map<string, string>>();
    for (const def of defs) {
      const value = own(groupValue, def.name);
      if (value === undefined) continue;
      const path = `${where}${group}.${def.name}`;
      if (statesOnly && !def.allowInStates) {
        warn(
          diagnostics,
          'style.not-allowed-in-state',
          `"${group}.${def.name}" cannot be set in a pseudo-state`,
          path,
        );
        continue;
      }
      // Motion is compiled by `planMotion` into keyframes and at-rules, not a declaration list.
      if (group === 'motion') continue;

      if (group === 'effects' && COMPOUND_NAMES.includes(def.name)) {
        const values: string[] = [];
        compileValue(def, def.name, value, path, theme, diagnostics, values);
        if (values.length > 0) {
          let parts = compound.get(def.cssProperty);
          if (parts === undefined) {
            parts = new Map();
            compound.set(def.cssProperty, parts);
          }
          parts.set(def.name, values[0]?.slice(def.name.length + 2) ?? '');
        }
        continue;
      }
      if (def.shape === 'value') {
        compileValue(def, def.cssProperty, value, path, theme, diagnostics, out);
        continue;
      }
      if (!isRecord(value)) {
        warn(
          diagnostics,
          'style.invalid-value',
          `"${group}.${def.name}" must be an object per ${def.shape === 'box' ? 'side' : 'corner'}`,
          path,
        );
        continue;
      }
      const keys = def.shape === 'box' ? BOX_SIDES : CORNERS;
      for (const extra of Object.keys(value)) {
        if (!(keys as readonly string[]).includes(extra)) {
          warn(
            diagnostics,
            'style.unknown-property',
            `unknown ${def.shape === 'box' ? 'side' : 'corner'} "${extra}"`,
            `${path}.${extra}`,
          );
        }
      }
      for (const key of keys) {
        const part = own(value, key);
        const property = def.sides?.[key];
        if (part === undefined || property === undefined) continue;
        compileValue(def, property, part, `${path}.${key}`, theme, diagnostics, out);
      }
    }
    for (const [property, parts] of compound) {
      const v = (name: string, fallback: string) => parts.get(name) ?? fallback;
      let css: string;
      if (property === 'box-shadow' || property === 'text-shadow') {
        const prefix = property === 'box-shadow' ? 'shadow' : 'textShadow';
        css = `${v(`${prefix}X`, '0px')} ${v(`${prefix}Y`, '0px')} ${v(`${prefix}Blur`, '0px')}`;
        if (property === 'box-shadow') css += ` ${v('shadowSpread', '0px')}`;
        css += ` ${v(`${prefix}Color`, '#000')}`;
        if (parts.get('shadowInset') === 'inset') css = `inset ${css}`;
      } else if (property === 'backdrop-filter') {
        css = `blur(${v('backdropBlur', '0px')})`;
      } else {
        const functions = property === 'filter' ? FILTER_FUNCTIONS : TRANSFORM_FUNCTIONS;
        css = functions
          .filter(([name]) => parts.has(name))
          .map(([name, fn]) => `${fn}(${parts.get(name)})`)
          .join(' ');
      }
      // Custom geometry always follows (and overrides) a token preset in this declaration.
      out.push(`${property}: ${css}`);
    }
  }
  return out.length === 0 ? undefined : out.join('; ');
}

/**
 * Compiles a node's styles to declaration lists (docs/styles.md, docs/responsive.md). Every value
 * goes back through its property's grammar, so only re-rendered, validated text can reach the
 * output — a value that fails is skipped and reported, whatever the caller validated earlier.
 * Declarations follow the registry's order, not the order keys were written in. Memoized on the
 * identity of `styles` and `theme`. Never throws.
 */
export function compileNodeDeclarations(styles: NodeStyles, theme: Theme): NodeDeclarations {
  if (!isRecord(styles)) return EMPTY;
  return memoizeByStyles(theme, styles, () => {
    const diagnostics: Diagnostic[] = [];
    const base = compileDecl(own(styles, 'base'), false, 'base.', theme, diagnostics);

    const state: Partial<Record<StyleState, string>> = {};
    const stateValue = own(styles, 'state');
    if (isRecord(stateValue)) {
      for (const key of Object.keys(stateValue)) {
        if (!(STYLE_STATES as readonly string[]).includes(key)) {
          warn(
            diagnostics,
            'style.unknown-property',
            `unknown pseudo-state "${key}"`,
            `state.${key}`,
          );
        }
      }
      for (const name of STYLE_STATES) {
        const css = compileDecl(own(stateValue, name), true, `state.${name}.`, theme, diagnostics);
        if (css !== undefined) state[name] = css;
      }
    }

    const bpEntries: [string, string][] = [];
    const bpValue = own(styles, 'bp');
    if (isRecord(bpValue)) {
      for (const id of Object.keys(bpValue)) {
        const css = compileDecl(bpValue[id], false, `bp.${id}.`, theme, diagnostics);
        if (css !== undefined) bpEntries.push([id, css]);
      }
    }
    // `fromEntries` defines own properties, so an id like `__proto__` can never touch a prototype.
    const bp = Object.fromEntries(bpEntries);

    const baseMotion = planMotion(
      own(own(styles, 'base') ?? {}, 'motion'),
      'base.',
      false,
      diagnostics,
    );
    const bpMotion: [string, MotionPlan][] = [];
    if (isRecord(bpValue)) {
      for (const id of Object.keys(bpValue)) {
        const plan = planMotion(own(bpValue[id] ?? {}, 'motion'), `bp.${id}.`, true, diagnostics);
        if (plan !== undefined) bpMotion.push([id, plan]);
      }
    }
    return Object.freeze({
      base,
      state: Object.freeze(state),
      bp: Object.freeze(bp),
      motion: Object.freeze({ base: baseMotion, bp: Object.freeze(Object.fromEntries(bpMotion)) }),
      diagnostics,
    });
  });
}

const rule = (id: NodeId, declarations: string, pseudo = ''): string =>
  `.${nodeClassName(id)}${pseudo} { ${declarations}; }`;

/**
 * A node's rules with their `.b-<id>` selector — what the canvas needs to keep one `<style>` up to
 * date node by node, and what `compileStyles` assembles. An id that could not be a safe class
 * name (anything outside `A-Z a-z 0-9 _ -`) produces no rules and one error diagnostic.
 */
const memoizeRules = createStylesMemo();

function buildRules(id: NodeId, styles: NodeStyles, theme: Theme): NodeRules {
  const declarations = compileNodeDeclarations(styles, theme);
  const tag = (d: Diagnostic): Diagnostic => ({ ...d, details: { ...d.details, nodeId: id } });

  const state: Partial<Record<StyleState, string>> = {};
  for (const name of STYLE_STATES) {
    const css = declarations.state[name];
    if (css !== undefined) state[name] = rule(id, css, `:${name}`);
  }
  const bp = Object.fromEntries(
    Object.entries(declarations.bp).map(([key, css]) => [key, rule(id, css)]),
  );

  const selector = `.${nodeClassName(id)}`;
  const motionBp = Object.fromEntries(
    Object.entries(declarations.motion.bp).map(([key, plan]) => [
      key,
      renderMotion(selector, plan),
    ]),
  );
  const keyframes = [
    ...new Set(
      [declarations.motion.base, ...Object.values(declarations.motion.bp)].flatMap((plan) =>
        plan === undefined ? [] : motionKeyframeNames(plan),
      ),
    ),
  ].sort();

  return {
    base: declarations.base === undefined ? undefined : rule(id, declarations.base),
    state,
    bp,
    motion: {
      base:
        declarations.motion.base === undefined
          ? undefined
          : renderMotion(selector, declarations.motion.base),
      bp: motionBp,
    },
    keyframes,
    diagnostics: declarations.diagnostics.map(tag),
  };
}

export function compileNodeRules(id: NodeId, styles: NodeStyles, theme: Theme): NodeRules {
  if (!SAFE_NODE_ID.test(id)) {
    return {
      base: undefined,
      state: {},
      bp: {},
      motion: { base: undefined, bp: {} },
      keyframes: [],
      diagnostics: [
        {
          code: 'style.invalid-node-id',
          message: 'the node id cannot be used as a CSS class name',
          severity: 'error',
          details: { nodeId: id },
        },
      ],
    };
  }
  if (!isRecord(styles)) {
    return {
      base: undefined,
      state: {},
      bp: {},
      motion: { base: undefined, bp: {} },
      keyframes: [],
      diagnostics: [],
    };
  }
  // Memoized per (theme, styles, id): the same `styles` object may sit on several nodes.
  const perId = memoizeRules(theme, styles, () => new Map<NodeId, NodeRules>());
  let rules = perId.get(id);
  if (rules === undefined) {
    rules = buildRules(id, styles, theme);
    perId.set(id, rules);
  }
  return rules;
}
