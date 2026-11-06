import {
  BOX_SIDES,
  CORNERS,
  parseStyleValue,
  resolveTokenRef,
  type StylePropertyDef,
  type Theme,
} from '@next-buildr/core';
import type { StyleLayer } from '@next-buildr/core/commands';

/** What an author typed, checked against the property's grammar and the theme. */
export type StyleInput =
  | { readonly ok: true; readonly value: string | number }
  | { readonly ok: false; readonly message: string };

const NUMERIC = /^-?\d+(\.\d+)?$/;
const TOKEN_IN_TEXT = /\$[A-Za-z]+\.[a-z0-9-]+/g;

/**
 * Turns typed text into the value to store: a number when the text is numeric and the grammar takes
 * one, else the text itself. It is accepted only when `parseStyleValue` accepts it and every token
 * in it exists in the theme, so nothing outside the grammar can be dispatched.
 */
export function checkStyleInput(def: StylePropertyDef, text: string, theme: Theme): StyleInput {
  const typed = text.trim();
  const candidates: (string | number)[] = NUMERIC.test(typed) ? [Number(typed), typed] : [typed];
  let message = '';
  for (const candidate of candidates) {
    const parsed = parseStyleValue(def.grammar, candidate, { inheritable: def.inheritable });
    if (!parsed.ok) {
      message ||= parsed.error.message;
      continue;
    }
    for (const token of typeof candidate === 'string'
      ? (candidate.match(TOKEN_IN_TEXT) ?? [])
      : []) {
      const known = resolveTokenRef(theme, token);
      if (!known.ok) return { ok: false, message: known.error.message };
    }
    return { ok: true, value: candidate };
  }
  return { ok: false, message };
}

/** The sides or corners of a shaped property, in the order the editor lays them out. */
export const partsOf = (def: StylePropertyDef): readonly string[] =>
  def.shape === 'box' ? BOX_SIDES : def.shape === 'corners' ? CORNERS : [];

/** The token references (`$space.4`) a property accepts in this theme, for suggestions. */
export function tokenSuggestions(def: StylePropertyDef, theme: Theme): string[] {
  const out: string[] = [];
  for (const scale of def.tokenScale ?? []) {
    for (const name of Object.keys(theme.tokens[scale])) out.push(`$${scale}.${name}`);
  }
  return out;
}

/** The keywords a property accepts, for suggestions and for the select of a pure enumeration. */
export function keywordsOf(def: StylePropertyDef): readonly string[] {
  const grammar = def.grammar;
  return grammar.kind === 'composite' || grammar.kind === 'color' ? (grammar.keywords ?? []) : [];
}

/** A property that is only a list of keywords is edited with a select. */
export function isEnumeration(def: StylePropertyDef): boolean {
  const grammar = def.grammar;
  return (
    grammar.kind === 'composite' &&
    (grammar.keywords?.length ?? 0) > 0 &&
    grammar.tokens === undefined &&
    grammar.length === undefined &&
    grammar.number === undefined
  );
}

/** The layer a breakpoint id edits: desktop is `{}`. */
export const layerFor = (breakpoint: string | undefined): StyleLayer => {
  if (breakpoint === 'state:hover') return { state: 'hover' };
  if (breakpoint === 'state:focus-visible') return { state: 'focus-visible' };
  if (breakpoint === 'state:active') return { state: 'active' };
  return breakpoint === undefined || breakpoint === 'base' ? {} : { bp: breakpoint };
};

/** The units the property's grammar allows, and nothing else: they are all the unit menu offers. */
export function unitsOf(def: StylePropertyDef): readonly string[] {
  const grammar = def.grammar;
  return grammar.kind === 'composite'
    ? (grammar.length?.units ?? []).filter(
        (unit) => def.group !== 'spacing' || ['px', '%', 'rem', 'vw'].includes(unit),
      )
    : [];
}

/** Whether the grammar takes a bare number (`opacity`, `lineHeight`) rather than only lengths. */
export function takesNumber(def: StylePropertyDef): boolean {
  const grammar = def.grammar;
  return grammar.kind === 'composite' && grammar.number !== undefined;
}

/** How much an arrow key adds: a fraction where the number is confined to a small range. */
export function stepOf(def: StylePropertyDef): number {
  const grammar = def.grammar;
  if (grammar.kind !== 'composite' || grammar.number === undefined) return 1;
  if (grammar.length !== undefined) return 1;
  if (grammar.number.integer === true && grammar.number.min >= 100) return 100;
  return grammar.number.max - grammar.number.min <= 10 && grammar.number.integer !== true ? 0.1 : 1;
}

/** Scrubbing follows the active notation: a length and a unitless number can have different limits. */
export function boundsOf(def: StylePropertyDef, value: string): { min?: number; max?: number } {
  const grammar = def.grammar;
  if (grammar.kind === 'gridTrack' || grammar.kind === 'gridSpan') return { min: 1, max: 12 };
  if (grammar.kind !== 'composite') return {};
  if (grammar.number !== undefined && !/[a-z%]$/i.test(value)) {
    return { min: grammar.number.min, max: grammar.number.max };
  }
  return grammar.length?.negative === true ? {} : { min: 0 };
}

/** Whether the property is edited as a number (with a unit menu) rather than as free keyword text. */
export function isNumeric(def: StylePropertyDef): boolean {
  return (
    unitsOf(def).length > 0 ||
    takesNumber(def) ||
    def.grammar.kind === 'gridTrack' ||
    def.grammar.kind === 'gridSpan'
  );
}

export interface TokenEntry {
  readonly ref: string;
  readonly scale: string;
  readonly name: string;
  /** What the token stands for in this theme: a colour, a length, a font stack. */
  readonly value: string;
}

/** The tokens a property accepts in this theme, with their values, for the picker. */
export function tokenEntries(def: StylePropertyDef, theme: Theme): TokenEntry[] {
  const out: TokenEntry[] = [];
  for (const scale of def.tokenScale ?? []) {
    for (const [name, value] of Object.entries(theme.tokens[scale])) {
      out.push({ ref: `$${scale}.${name}`, scale, name, value: String(value) });
    }
  }
  return out;
}

/** The colour a text stands for, to paint a swatch: a token of the theme or a literal colour. */
export function colorOf(def: StylePropertyDef, text: string, theme: Theme): string | undefined {
  if (def.grammar.kind !== 'color') return undefined;
  if (text.startsWith('$')) {
    const known = resolveTokenRef(theme, text);
    return known.ok && known.value.scale === 'color' ? known.value.value : undefined;
  }
  return text;
}

/** A number confined to a range of at most one (opacity) is also edited with a slider. */
export function sliderOf(
  def: StylePropertyDef,
): { readonly min: number; readonly max: number; readonly step: number } | undefined {
  const grammar = def.grammar;
  if (grammar.kind !== 'composite' || grammar.number === undefined) return undefined;
  if (grammar.length !== undefined) return undefined;
  const { min, max } = grammar.number;
  return max - min <= 1 ? { min, max, step: 0.01 } : undefined;
}

/** How a numeric property is edited with a slider: its span, the unit it writes and what it shows. */
export interface RangeSpec {
  readonly min: number;
  readonly max: number;
  readonly step: number;
  /** The unit written after the number (`px`, `deg`); empty for a bare number. */
  readonly unit: string;
  /** The value the property has while nothing sets it; the slider rests there and the field hints it. */
  readonly fallback: number;
  /** Bare numbers shown as a share (`1` as `100%`). */
  readonly percent?: boolean;
}

const px = (min: number, max: number, fallback = 0): RangeSpec => ({
  min,
  max,
  step: 1,
  unit: 'px',
  fallback,
});
const deg = (min: number, max: number): RangeSpec => ({
  min,
  max,
  step: 1,
  unit: 'deg',
  fallback: 0,
});
const ms = (min: number, max: number, step: number, fallback: number): RangeSpec => ({
  min,
  max,
  step,
  unit: 'ms',
  fallback,
});
const share = (min: number, max: number, fallback: number): RangeSpec => ({
  min,
  max,
  step: 0.01,
  unit: '',
  fallback,
  percent: true,
});

/** Sliders of the effects group (docs/design/template: shadow, filters, transforms). */
export const RANGES: Readonly<Record<string, RangeSpec>> = {
  'effects.shadowX': px(-40, 40),
  'effects.shadowY': px(-40, 40),
  'effects.shadowBlur': px(0, 80),
  'effects.shadowSpread': px(-40, 40),
  'effects.textShadowX': px(-10, 10),
  'effects.textShadowY': px(-10, 10),
  'effects.textShadowBlur': px(0, 20),
  'effects.blur': px(0, 20),
  'effects.backdropBlur': px(0, 40),
  'effects.brightness': share(0, 2, 1),
  'effects.contrast': share(0, 2, 1),
  'effects.saturate': share(0, 2, 1),
  'effects.grayscale': share(0, 1, 0),
  'effects.sepia': share(0, 1, 0),
  'effects.invert': share(0, 1, 0),
  'effects.hueRotate': deg(-180, 180),
  'effects.rotate': deg(-180, 180),
  'effects.skewX': deg(-45, 45),
  'effects.skewY': deg(-45, 45),
  'effects.scale': share(0.5, 1.5, 1),
  'effects.opacity': share(0, 1, 1),
  // Motion (ADR-027): the defaults are the compiler's (600ms entrance, 200ms hover).
  'motion.entranceDuration': ms(0, 2000, 50, 600),
  'motion.entranceDelay': ms(0, 2000, 50, 0),
  'motion.hoverDuration': ms(0, 1000, 20, 200),
  'motion.scrollParallax': { min: 0, max: 200, step: 5, unit: 'px', fallback: 0 },
};

/** What an unset keyword property does, so an empty select can say it instead of showing a dash. */
export const KEYWORD_DEFAULTS: Readonly<Record<string, string>> = {
  'effects.blendMode': 'normal',
  'effects.shadowInset': 'outset',
  'effects.cursor': 'auto',
  'effects.transformOrigin': 'center',
  'motion.entrance': 'none',
  'motion.entranceEasing': 'ease-out',
  'motion.hover': 'none',
  'motion.scrollReveal': 'none',
};

/** The number a slider position stands for, written as the text the grammar takes. */
export const rangeText = (spec: RangeSpec, value: number): string =>
  `${Number(value.toFixed(4))}${spec.unit}`;

/** The text a slider's bubble shows. */
export const rangeShown = (spec: RangeSpec, value: number): string =>
  spec.percent === true ? `${Math.round(value * 100)}%` : `${Number(value.toFixed(2))}${spec.unit}`;
