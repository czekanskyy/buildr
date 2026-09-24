import type { DataContext } from '../../data/context.ts';
import type { JsonValue } from '../../json/json-value.ts';

/** Max elements a list operation (`join`, `includes`, `slice`, ...) will touch (docs/expressions.md#limits). */
export const MAX_LIST_ELEMENTS = 1000;
/** Max length of any string an evaluation produces, in UTF-16 code units. */
export const MAX_RESULT_TEXT = 10_000;

/** The runtime type a stdlib parameter accepts. `any` also accepts `null`; every other kind does not (see `EagerStdlibFunction`). */
export type StdlibParamType = 'any' | 'string' | 'number' | 'boolean' | 'list' | 'object';

export interface StdlibParam {
  readonly type: StdlibParamType;
  readonly optional?: boolean;
}

/** Locale and time zone of the running evaluation — what the `Intl`-backed functions need. */
export type StdlibEnv = Pick<DataContext, 'locale' | 'timeZone'> & {
  /** Charges `n` evaluation steps for work proportional to the size of an input. */
  readonly charge: (n: number) => void;
};

/**
 * A recoverable problem inside a stdlib function (a bad `digits`, an unknown currency, ...). The
 * evaluator turns it into a warning `Diagnostic` and evaluates the call to `null`.
 */
export class StdlibArgError extends Error {}

interface StdlibBase {
  readonly name: string;
  /** Fixed parameters, in order; the trailing ones may be `optional`. */
  readonly params: readonly StdlibParam[];
  /** When set, any number of further arguments of this type are accepted after `params`. */
  readonly rest?: StdlibParam | undefined;
  /**
   * The type of the result (`any` when it depends on the arguments, e.g. `first`, `if`) — what
   * the typechecker infers for a call. `null` is always possible at runtime and is not modelled.
   */
  readonly returns: StdlibParamType;
  /** One-line description for the formula editor's autocomplete. */
  readonly doc: string;
}

/**
 * A function whose arguments are evaluated before the call. If an argument is `null` and its
 * declared type is not `any`, the call is `null` without running `run` (a missing value propagates
 * quietly); an argument of the wrong non-null type is a warning and `null`.
 */
export interface EagerStdlibFunction extends StdlibBase {
  readonly lazy?: false;
  readonly run: (args: readonly JsonValue[], env: StdlibEnv) => JsonValue;
}

/** A function that decides which of its arguments get evaluated (`if`, `coalesce`), so an untaken branch never runs. */
export interface LazyStdlibFunction extends StdlibBase {
  readonly lazy: true;
  readonly run: (args: readonly (() => JsonValue)[], env: StdlibEnv) => JsonValue;
}

export type StdlibFunction = EagerStdlibFunction | LazyStdlibFunction;

/** Whether the stdlib's arity rules accept `count` arguments. */
export function acceptsArity(fn: StdlibFunction, count: number): boolean {
  const required = fn.params.filter((p) => p.optional !== true).length;
  if (count < required) return false;
  return fn.rest !== undefined || count <= fn.params.length;
}

/** The declared parameter for the argument at `index` (a `rest` parameter covers everything after `params`). */
export function paramAt(fn: StdlibFunction, index: number): StdlibParam | undefined {
  return fn.params[index] ?? fn.rest;
}

/** The runtime type of `value` in the vocabulary of `StdlibParamType`. */
export function typeOf(value: JsonValue): Exclude<StdlibParamType, 'any'> | 'null' {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'list';
  return typeof value as 'string' | 'number' | 'boolean' | 'object';
}

/**
 * Renders a scalar for concatenation (`+`, `concat`, `join`, template interpolation): `null` is
 * the empty string. Lists and objects have no text form — `undefined`.
 */
export function stringify(value: JsonValue): string | undefined {
  if (value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}
