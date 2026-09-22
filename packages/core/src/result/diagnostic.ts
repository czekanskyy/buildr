import type { JsonValue } from '../json/json-value.ts';

export type DiagnosticSeverity = 'error' | 'warning';

/**
 * A structured, non-throwing description of a data problem — validation failures, invariant
 * violations, binding/expression fallbacks (see docs/ai/coding-rules.md and
 * docs/ai/architecture-rules.md #7). `path` locates the offending value inside a document or
 * payload; `details` carries context specific to the emitting code (e.g. `nodeId`, `prop`).
 */
export interface Diagnostic {
  readonly code: string;
  readonly message: string;
  readonly severity: DiagnosticSeverity;
  readonly path?: readonly (string | number)[];
  readonly details?: Readonly<Record<string, JsonValue>>;
}
