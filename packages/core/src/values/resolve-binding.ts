import type { DataContext } from '../data/context.ts';
import { getPath } from '../data/path.ts';
import type { JsonValue } from '../json/json-value.ts';
import type { Diagnostic } from '../result/diagnostic.ts';
import type { BindingValue } from './types.ts';

/** The outcome of `resolveBinding` — `value: undefined` (with a `binding.missing` diagnostic) means the caller should continue down the fallback chain to the prop's own default (docs/dynamic-bindings.md#resolution, step 6). */
export interface BindingResolution {
  readonly value: JsonValue | undefined;
  readonly diagnostics: readonly Diagnostic[];
}

/**
 * Resolves a `BindingValue` against `ctx.scopes` (docs/dynamic-bindings.md#resolution, step 2):
 * `getPath` reads `binding.path` off the data tree, supporting `a.b.c` segments and `[n]` numeric
 * indices while rejecting `__proto__`/`prototype`/`constructor` outright (PB-019). A path that
 * doesn't resolve — malformed, out of range, the wrong shape, or genuinely absent from the data —
 * falls back to `binding.fallback` when one is set; either way a `binding.missing` diagnostic is
 * emitted, since even a successful fallback is still a data problem worth surfacing (tree badges,
 * the Issues panel). Never throws: `getPath` itself never throws, and this adds no further
 * fallibility of its own.
 */
export function resolveBinding(binding: BindingValue, ctx: DataContext): BindingResolution {
  const raw = getPath(ctx.scopes, binding.path);
  if (raw !== undefined) return { value: raw, diagnostics: [] };

  const diagnostic: Diagnostic = {
    code: 'binding.missing',
    message: `binding path "${binding.path}" did not resolve to a value`,
    severity: 'warning',
    details: { path: binding.path },
  };
  // `BindingValue<T>.fallback` is `T` (default `unknown`), but every `Value` in the document
  // ultimately holds JSON (the AST is the source of truth, ADR-002) — so a fallback the author set
  // is JSON-safe by construction, same as `binding.path` itself.
  return { value: binding.fallback as JsonValue | undefined, diagnostics: [diagnostic] };
}
