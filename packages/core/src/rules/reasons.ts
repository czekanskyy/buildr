import type { JsonValue } from '../json/json-value.ts';

/**
 * Every code a rule in this module can reject with (docs/component-registry.md#content-model-and-
 * nesting-rules). Kept as one union rather than per-function unions so a caller building a single
 * error-message table (or a test asserting "every code is covered") has one place to look.
 */
export type ReasonCode =
  | 'target-not-found'
  | 'node-not-found'
  | 'unknown-component-type'
  | 'not-insertable'
  | 'root-only'
  | 'slot-not-found'
  | 'slot-denied'
  | 'slot-not-allowed'
  | 'parent-denied'
  | 'parent-not-allowed'
  | 'missing-required-ancestor'
  | 'heading-requires-phrasing'
  | 'nested-interactive'
  | 'nested-form'
  | 'form-control-outside-form'
  | 'slot-max-exceeded'
  | 'slot-min-violation'
  | 'invalid-index'
  | 'cycle'
  | 'locked-structure'
  | 'locked-content'
  | 'locked-style'
  | 'not-removable'
  | 'not-draggable'
  | 'cannot-remove-root'
  | 'cannot-move-root';

/**
 * Why a structural or edit command was rejected — the `Err` side of every `canInsert`/`canMove`/
 * `canRemove`/`canEdit` `Result` (docs/component-registry.md#content-model-and-nesting-rules).
 * `message` is meant to be shown to an end user as-is (e.g. a toast); `code`/`params` are for
 * tests and telemetry, not display.
 */
export interface Reason {
  readonly code: ReasonCode;
  readonly message: string;
  readonly params?: Readonly<Record<string, JsonValue>>;
}

export function reason(
  code: ReasonCode,
  message: string,
  params?: Readonly<Record<string, JsonValue>>,
): Reason {
  return params !== undefined ? { code, message, params } : { code, message };
}
