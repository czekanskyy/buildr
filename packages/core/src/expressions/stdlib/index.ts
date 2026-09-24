import { formatFunctions } from './format.ts';
import { listFunctions } from './list.ts';
import { logicFunctions } from './logic.ts';
import { numberFunctions } from './number.ts';
import { textFunctions } from './text.ts';
import type { StdlibFunction } from './types.ts';

const ALL: readonly StdlibFunction[] = [
  ...textFunctions,
  ...numberFunctions,
  ...formatFunctions,
  ...listFunctions,
  ...logicFunctions,
];

/**
 * The allowlist of functions an expression may call (docs/expressions.md#standard-library-mvp),
 * keyed by name. Frozen and null-prototype so a call to `constructor` or `__proto__` is simply an
 * unknown function; look names up with `Object.hasOwn`.
 */
export const stdlib: Readonly<Record<string, StdlibFunction>> = Object.freeze(
  Object.assign(
    Object.create(null) as Record<string, StdlibFunction>,
    ...ALL.map((fn) => ({ [fn.name]: fn })),
  ),
);

export type {
  EagerStdlibFunction,
  LazyStdlibFunction,
  StdlibEnv,
  StdlibFunction,
  StdlibParam,
  StdlibParamType,
} from './types.ts';
export { acceptsArity, MAX_LIST_ELEMENTS, MAX_RESULT_TEXT, paramAt } from './types.ts';
