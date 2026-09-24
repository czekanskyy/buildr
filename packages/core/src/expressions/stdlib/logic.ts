import type { JsonValue } from '../../json/json-value.ts';
import type { StdlibFunction } from './types.ts';

/** `null`, `false`, `0` and `''` are falsy; everything else (including `[]` and `{}`) is truthy. */
export function isTruthy(value: JsonValue): boolean {
  return value !== null && value !== false && value !== 0 && value !== '';
}

/** `null`, `''`, an empty list and an object without keys are empty; numbers and booleans never are. */
function isEmpty(value: JsonValue): boolean {
  if (value === null || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

export const logicFunctions: readonly StdlibFunction[] = [
  {
    name: 'if',
    lazy: true,
    params: [{ type: 'any' }, { type: 'any' }, { type: 'any' }],
    doc: 'if(c, a, b) — a when c is truthy, otherwise b; only the chosen branch is evaluated',
    run: ([test, consequent, alternate]) =>
      isTruthy((test as () => JsonValue)())
        ? (consequent as () => JsonValue)()
        : (alternate as () => JsonValue)(),
  },
  {
    name: 'coalesce',
    lazy: true,
    params: [{ type: 'any' }],
    rest: { type: 'any' },
    doc: 'coalesce(...) — the first argument that is not null, or null',
    run: (args) => {
      for (const arg of args) {
        const value = arg();
        if (value !== null) return value;
      }
      return null;
    },
  },
  {
    name: 'isEmpty',
    params: [{ type: 'any' }],
    doc: 'isEmpty(x) — whether x is null, an empty text, an empty list or an empty object',
    run: ([x]) => isEmpty(x as JsonValue),
  },
];
