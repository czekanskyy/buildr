import type { JsonValue } from '../../json/json-value.ts';
import {
  MAX_LIST_ELEMENTS,
  StdlibArgError,
  type StdlibEnv,
  type StdlibFunction,
  stringify,
} from './types.ts';

/** Checks the list-size limit and charges one step per element. */
function bounded(list: readonly JsonValue[], env: StdlibEnv): readonly JsonValue[] {
  if (list.length > MAX_LIST_ELEMENTS) {
    throw new StdlibArgError(`lists longer than ${MAX_LIST_ELEMENTS} elements are not supported`);
  }
  env.charge(list.length);
  return list;
}

/** Structural equality for JSON values (`==` is strict — no coercion — but lists and objects compare by content). */
export function jsonEquals(a: JsonValue, b: JsonValue, depth = 0): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (depth > 64) return false;
  const aList = Array.isArray(a);
  if (aList !== Array.isArray(b)) return false;
  if (aList) {
    const left = a as readonly JsonValue[];
    const right = b as readonly JsonValue[];
    return (
      left.length === right.length &&
      left.every((v, i) => jsonEquals(v, right[i] as JsonValue, depth + 1))
    );
  }
  const left = a as { readonly [key: string]: JsonValue };
  const right = b as { readonly [key: string]: JsonValue };
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every(
      (k) =>
        Object.hasOwn(right, k) &&
        jsonEquals(left[k] as JsonValue, right[k] as JsonValue, depth + 1),
    )
  );
}

function index(value: JsonValue | undefined, fallback: number, what: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new StdlibArgError(`${what} must be an integer`);
  }
  return value;
}

export const listFunctions: readonly StdlibFunction[] = [
  {
    name: 'count',
    params: [{ type: 'any' }],
    doc: 'count(list) — the number of elements; null is 0',
    run: ([list]) => {
      if (list === null) return 0;
      if (!Array.isArray(list)) throw new StdlibArgError('count expects a list');
      return list.length;
    },
  },
  {
    name: 'first',
    params: [{ type: 'list' }],
    doc: 'first(list) — the first element, or null when empty',
    run: ([list]) => (list as readonly JsonValue[])[0] ?? null,
  },
  {
    name: 'last',
    params: [{ type: 'list' }],
    doc: 'last(list) — the last element, or null when empty',
    run: ([list]) => (list as readonly JsonValue[]).at(-1) ?? null,
  },
  {
    name: 'join',
    params: [{ type: 'list' }, { type: 'string' }],
    doc: 'join(list, sep) — the elements as text separated by sep; null elements are empty',
    run: ([list, sep], env) => {
      const parts: string[] = [];
      for (const item of bounded(list as readonly JsonValue[], env)) {
        const part = stringify(item);
        if (part === undefined) throw new StdlibArgError('join cannot render a list or an object');
        parts.push(part);
      }
      return parts.join(sep as string);
    },
  },
  {
    name: 'includes',
    params: [{ type: 'list' }, { type: 'any' }],
    doc: 'includes(list, v) — whether the list contains v (strict equality)',
    run: ([list, value], env) =>
      bounded(list as readonly JsonValue[], env).some((item) =>
        jsonEquals(item, value as JsonValue),
      ),
  },
  {
    name: 'slice',
    params: [{ type: 'list' }, { type: 'number' }, { type: 'number', optional: true }],
    doc: 'slice(list, start, end?) — the elements from start up to (not including) end; negative counts from the end',
    run: ([list, start, end], env) => {
      const items = bounded(list as readonly JsonValue[], env);
      return items.slice(index(start, 0, 'start'), index(end, items.length, 'end'));
    },
  },
];
