import {
  BOX_SIDES,
  CORNERS,
  parseStyleValue,
  resolveTokenRef,
  type StylePropertyDef,
  type Theme,
} from '@next-buildr/core';

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
export const layerFor = (breakpoint: string | undefined) =>
  breakpoint === undefined || breakpoint === 'base' ? {} : { bp: breakpoint };

/** The units the property's grammar allows, and nothing else: they are all the unit menu offers. */
export function unitsOf(def: StylePropertyDef): readonly string[] {
  const grammar = def.grammar;
  return grammar.kind === 'composite' ? (grammar.length?.units ?? []) : [];
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
  return grammar.number.max - grammar.number.min <= 10 && grammar.number.integer !== true ? 0.1 : 1;
}

/** Whether the property is edited as a number (with a unit menu) rather than as free keyword text. */
export function isNumeric(def: StylePropertyDef): boolean {
  return unitsOf(def).length > 0 || takesNumber(def);
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
