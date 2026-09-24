import type { DataContext } from '../data/context.ts';
import type { FilterNode, QuerySpec, ResolvedQuerySpec } from '../data/query-spec.ts';
import type { Value } from '../document/types.ts';
import { type CompileCache, compileExpression, compileTemplate } from '../expressions/compile.ts';
import type { JsonValue } from '../json/json-value.ts';
import type { Diagnostic } from '../result/diagnostic.ts';
import { err, ok, type Result } from '../result/result.ts';
import { resolveBinding } from '../values/resolve-binding.ts';

export interface ResolveQueryOptions {
  readonly cache?: CompileCache;
  /** The `id` of the document being rendered, used by `excludeCurrent`. */
  readonly currentId?: string | number;
}

interface Resolved {
  readonly value: JsonValue | undefined;
  readonly diagnostics: readonly Diagnostic[];
}

function resolveOperand(
  value: Value,
  ctx: DataContext,
  options: ResolveQueryOptions | undefined,
): Resolved {
  if (value.kind === 'static') return { value: value.value as JsonValue, diagnostics: [] };
  if (value.kind === 'binding') {
    const resolved = resolveBinding(value, ctx);
    return { value: resolved.value, diagnostics: resolved.diagnostics };
  }
  const sink: Diagnostic[] = [];
  let result: Result<JsonValue, Diagnostic>;
  if (value.mode === 'template') {
    const compiled = options?.cache
      ? options.cache.template(value.expr)
      : compileTemplate(value.expr);
    result = compiled.ok ? compiled.value.evaluate(ctx, { diagnostics: sink }) : compiled;
  } else {
    const compiled = options?.cache
      ? options.cache.expression(value.expr)
      : compileExpression(value.expr);
    result = compiled.ok ? compiled.value.evaluate(ctx, { diagnostics: sink }) : compiled;
  }
  if (!result.ok) return { value: undefined, diagnostics: [...sink, result.error] };
  return { value: result.value, diagnostics: sink };
}

/**
 * Resolves the `Value`s of a `QuerySpec` against `ctx` (docs/dynamic-bindings.md#lists-and-
 * queries-loop-query). An operand that does not resolve makes the whole query fail (`Err`) rather
 * than dropping its condition — a dropped condition would widen the result set. An explicit `null`
 * operand is a legitimate value. `page` defaults to 1, and an invalid one is a warning and 1; a whole number written as text (a route parameter) counts as that number.
 * Never throws.
 */
export function resolveQuerySpec(
  spec: QuerySpec,
  ctx: DataContext,
  options?: ResolveQueryOptions,
): Result<{ spec: ResolvedQuerySpec; diagnostics: readonly Diagnostic[] }, readonly Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  let failed = false;

  const walk = (filter: FilterNode<Value>): FilterNode<JsonValue> => {
    if ('and' in filter) return { and: filter.and.map(walk) };
    if ('or' in filter) return { or: filter.or.map(walk) };
    const operand = resolveOperand(filter.value, ctx, options);
    diagnostics.push(...operand.diagnostics);
    if (operand.value === undefined) {
      failed = true;
      diagnostics.push({
        code: 'query.unresolved-value',
        message: `the value for "${filter.field}" could not be resolved`,
        severity: 'error',
        details: { field: filter.field },
      });
    }
    return { field: filter.field, op: filter.op, value: operand.value ?? null };
  };

  const where = spec.where === undefined ? undefined : walk(spec.where);

  let page = 1;
  if (spec.page !== undefined) {
    const resolved = resolveOperand(spec.page, ctx, options);
    diagnostics.push(...resolved.diagnostics);
    // A route parameter is always text, so `route.params.page` arrives as "2".
    const raw =
      typeof resolved.value === 'string' && /^\d{1,9}$/.test(resolved.value)
        ? Number(resolved.value)
        : resolved.value;
    if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 1) page = raw;
    else if (raw !== undefined && raw !== null) {
      diagnostics.push({
        code: 'query.invalid-page',
        message: 'the page must be a whole number from 1; using page 1',
        severity: 'warning',
      });
    }
  }

  if (failed) return err(diagnostics);

  const excludeId = spec.excludeCurrent === true ? options?.currentId : undefined;
  if (spec.excludeCurrent === true && excludeId === undefined) {
    diagnostics.push({
      code: 'query.no-current',
      message: 'excludeCurrent is set but the current document has no id; nothing is excluded',
      severity: 'warning',
    });
  }

  return ok({
    spec: {
      source: spec.source,
      ...(where === undefined ? {} : { where }),
      ...(spec.sort === undefined ? {} : { sort: spec.sort }),
      limit: spec.limit,
      page,
      ...(excludeId === undefined ? {} : { excludeId }),
    },
    diagnostics,
  });
}
