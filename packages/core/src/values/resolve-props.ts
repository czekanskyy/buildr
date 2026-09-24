import type { DataContext } from '../data/context.ts';
import type { PageNode } from '../document/types.ts';
import { type CompileCache, compileExpression, compileTemplate } from '../expressions/compile.ts';
import { isTruthy } from '../expressions/stdlib/logic.ts';
import type { JsonValue } from '../json/json-value.ts';
import type { ComponentMeta } from '../registry/meta.ts';
import type { Diagnostic } from '../result/diagnostic.ts';
import type { PropDef } from '../schema/kinds/index.ts';
import { validatePropValue } from '../schema/validate.ts';
import { type CoercibleKind, coerceValue } from './coerce.ts';
import { resolveBinding } from './resolve-binding.ts';
import { capString, sanitizeUrl } from './sanitize.ts';
import type { BindingValue, ExpressionValue, LocaleCode, Value } from './types.ts';

export interface ResolvePropsOptions {
  /**
   * Reuses parsed expressions across calls (a `createCompileCache()` the caller owns). Without
   * one, every expression is parsed again on each call.
   */
  readonly cache?: CompileCache;
}

export interface ResolvedPropsResult {
  /** One entry per prop declared by the component (a prop with no value and no default is omitted). JSON-serializable. */
  readonly props: Readonly<Record<string, JsonValue>>;
  /** Every problem met on the way, each tagged with `details.nodeId` and `details.prop`. */
  readonly diagnostics: readonly Diagnostic[];
}

export interface ResolvedVisibility {
  readonly visible: boolean;
  readonly diagnostics: readonly Diagnostic[];
}

const COERCIBLE: Readonly<Record<string, CoercibleKind>> = {
  text: 'text',
  textarea: 'text',
  link: 'link',
  media: 'media',
  richText: 'richText',
  boolean: 'boolean',
  number: 'number',
  listSource: 'listSource',
};

function tag(d: Diagnostic, nodeId: string, prop?: string): Diagnostic {
  return {
    ...d,
    details: { ...d.details, nodeId, ...(prop === undefined ? {} : { prop }) },
  };
}

function isValue(raw: unknown): raw is Value<JsonValue> {
  if (typeof raw !== 'object' || raw === null) return false;
  const kind = (raw as { kind?: unknown }).kind;
  return kind === 'static' || kind === 'binding' || kind === 'expression';
}

/** Whether `locale` selects a translation instead of the default-locale value. */
function translation<T>(
  l10n: Readonly<Partial<Record<LocaleCode, T>>> | undefined,
  ctx: DataContext,
): T | undefined {
  if (l10n === undefined || ctx.locale === ctx.locales.default) return undefined;
  return Object.hasOwn(l10n, ctx.locale) ? l10n[ctx.locale] : undefined;
}

/** Everything one prop's resolution needs, so the helpers stay small. */
interface PropRun {
  readonly node: PageNode;
  readonly name: string;
  readonly def: PropDef;
  readonly ctx: DataContext;
  readonly options: ResolvePropsOptions | undefined;
  readonly out: Diagnostic[];
}

function report(run: PropRun, d: Diagnostic): void {
  run.out.push(tag(d, run.node.id, run.name));
}

function warn(run: PropRun, code: string, message: string): void {
  report(run, { code, message, severity: 'warning' });
}

function translates(run: PropRun): boolean {
  return run.def.localizable && run.ctx.locale !== run.ctx.locales.default;
}

/** A static value, translated for the active locale when the prop is localizable. */
function resolveStatic(
  run: PropRun,
  value: Extract<Value, { kind: 'static' }>,
): JsonValue | undefined {
  if (translates(run)) {
    const translated = translation(value.l10n, run.ctx);
    if (translated !== undefined) return translated as JsonValue;
    if (!run.ctx.locales.fallback) {
      warn(
        run,
        'l10n.missing-translation',
        `no "${run.ctx.locale}" translation and fallback is off`,
      );
      return undefined;
    }
  }
  return value.value as JsonValue | undefined;
}

function resolveExpression(run: PropRun, value: ExpressionValue): JsonValue | undefined {
  const { ctx, options } = run;
  const sink: Diagnostic[] = [];
  let result: { ok: true; value: JsonValue } | { ok: false; error: Diagnostic };

  if (value.mode === 'template') {
    let source = value.expr;
    if (translates(run)) {
      const translated = translation(value.l10n, ctx);
      if (translated !== undefined) source = translated;
      else if (!ctx.locales.fallback) {
        warn(run, 'l10n.missing-translation', `no "${ctx.locale}" template and fallback is off`);
        return undefined;
      }
    }
    const compiled = options?.cache ? options.cache.template(source) : compileTemplate(source);
    result = compiled.ok ? compiled.value.evaluate(ctx, { diagnostics: sink }) : compiled;
  } else {
    const compiled = options?.cache
      ? options.cache.expression(value.expr)
      : compileExpression(value.expr);
    result = compiled.ok ? compiled.value.evaluate(ctx, { diagnostics: sink }) : compiled;
  }

  for (const d of sink) report(run, d);
  if (!result.ok) {
    report(run, result.error);
    return undefined;
  }
  return result.value;
}

/** Static-value hygiene the prop's own kind requires: URLs are sanitized, over-long text is capped. */
function sanitizeStatic(run: PropRun, value: JsonValue): JsonValue | undefined {
  const { def } = run;
  if (def.kind === 'link' && typeof value === 'string' && value !== '') {
    const url = sanitizeUrl(value);
    if (!url.ok) {
      report(run, url.error);
      return undefined;
    }
    return url.value;
  }
  if (
    (def.kind === 'text' || def.kind === 'textarea') &&
    typeof value === 'string' &&
    def.maxLength !== undefined &&
    value.length > def.maxLength
  ) {
    warn(run, 'prop.truncated', `text was longer than ${def.maxLength} characters and was cut`);
    return capString(value, def.maxLength);
  }
  return value;
}

/** Steps 4-5 for a dynamic value: coerce to the prop's kind, then cap and validate. */
function finish(
  run: PropRun,
  raw: JsonValue,
  format: BindingValue['format'],
): JsonValue | undefined {
  const kind = COERCIBLE[run.def.kind];
  let value = raw;
  if (kind !== undefined) {
    const coerced = coerceValue(raw, kind, run.ctx, format);
    for (const d of coerced.diagnostics) report(run, d);
    if (coerced.value === undefined) return undefined;
    value = coerced.value;
  }
  return sanitizeStatic(run, value);
}

function resolveOne(run: PropRun): JsonValue | undefined {
  const { node, name, def } = run;
  const fallbackToDefault = def.default as JsonValue | undefined;
  const raw: unknown = node.props?.[name];
  if (raw === undefined) return fallbackToDefault;
  if (!isValue(raw)) {
    warn(run, 'prop.invalid-value', 'the value is not a static, binding or expression value');
    return fallbackToDefault;
  }

  let candidate: JsonValue | undefined;
  let own: JsonValue | undefined;

  if (raw.kind === 'static') {
    candidate = resolveStatic(run, raw);
    if (candidate !== undefined) candidate = sanitizeStatic(run, candidate);
  } else {
    if (COERCIBLE[def.kind] === undefined || def.accepts.length === 0 || def.bindable === false) {
      warn(run, 'binding.not-bindable', `prop kind "${def.kind}" cannot take a ${raw.kind}`);
      return fallbackToDefault;
    }
    own = raw.fallback;
    if (raw.kind === 'binding') {
      const resolved = resolveBinding(raw, run.ctx);
      for (const d of resolved.diagnostics) report(run, d);
      // `resolveBinding` already applied the binding's fallback for a missing path; a path that
      // resolves to an explicit `null` still deserves it.
      candidate = resolved.value === null ? undefined : resolved.value;
      candidate = candidate === undefined ? undefined : finish(run, candidate, raw.format);
    } else {
      const value = resolveExpression(run, raw);
      candidate = value === null || value === undefined ? undefined : finish(run, value, undefined);
    }
  }

  // Fallback chain (docs/dynamic-bindings.md#resolution, step 6): the value's own `fallback`, then
  // the prop's default, then nothing.
  let previous: JsonValue | undefined;
  for (const option of [candidate, own, fallbackToDefault]) {
    if (option === undefined || option === null || option === previous) continue;
    previous = option;
    const valid = validatePropValue(def, option);
    if (valid.ok) return valid.value as JsonValue;
    report(run, valid.error);
  }
  return fallbackToDefault === null ? null : undefined;
}

/**
 * The single entry point for turning a node's raw props into the values its component receives
 * (docs/dynamic-bindings.md#resolution): for every prop the component declares, resolve the
 * static/binding/expression value (with locale selection for localizable props), coerce it to the
 * prop's kind, sanitize and validate it, and fall back to the value's own `fallback` and then the
 * prop's `default`. Props the component does not declare are dropped. Never throws — a failure in
 * one prop becomes a diagnostic and that prop falls back — and the result is plain JSON.
 */
export function resolveProps(
  node: PageNode,
  meta: ComponentMeta,
  ctx: DataContext,
  options?: ResolvePropsOptions,
): ResolvedPropsResult {
  const diagnostics: Diagnostic[] = [];
  const entries: [string, JsonValue][] = [];

  for (const [name, def] of Object.entries(meta.props)) {
    const run: PropRun = { node, name, def, ctx, options, out: diagnostics };
    let value: JsonValue | undefined;
    try {
      value = resolveOne(run);
    } catch (error) {
      report(run, {
        code: 'prop.internal',
        message: `resolving the prop failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'error',
      });
      value = def.default as JsonValue | undefined;
    }
    if (value !== undefined) entries.push([name, value]);
  }

  // `fromEntries` defines own properties, so a prop named `__proto__` cannot touch the prototype.
  return { props: Object.fromEntries(entries), diagnostics };
}

/**
 * Whether a node renders (`PageNode.visibleIf`, docs/renderer.md): no condition means visible;
 * otherwise the resolved value's truthiness decides (`null`, `false`, `0` and `""` are falsy), so
 * missing data hides the node. A condition that cannot be evaluated — malformed, a syntax error, a
 * breached limit — also hides it (fail closed) and reports a diagnostic tagged with `nodeId`.
 * Never throws.
 */
export function resolveVisibility(
  node: PageNode,
  ctx: DataContext,
  options?: ResolvePropsOptions,
): ResolvedVisibility {
  const condition: unknown = node.visibleIf;
  if (condition === undefined || condition === null) return { visible: true, diagnostics: [] };

  const diagnostics: Diagnostic[] = [];
  const fail = (code: string, message: string): ResolvedVisibility => ({
    visible: false,
    diagnostics: [
      ...diagnostics,
      tag({ code, message, severity: 'warning' }, node.id, 'visibleIf'),
    ],
  });

  if (!isValue(condition)) {
    return fail('visibility.invalid', 'visibleIf is not a static, binding or expression value');
  }
  try {
    let value: JsonValue | undefined;
    if (condition.kind === 'static') {
      value = condition.value as JsonValue;
    } else if (condition.kind === 'binding') {
      const resolved = resolveBinding(condition, ctx);
      for (const d of resolved.diagnostics) diagnostics.push(tag(d, node.id, 'visibleIf'));
      value = resolved.value;
    } else {
      const sink: Diagnostic[] = [];
      const compiled = options?.cache
        ? options.cache.expression(condition.expr)
        : compileExpression(condition.expr);
      const result = compiled.ok ? compiled.value.evaluate(ctx, { diagnostics: sink }) : compiled;
      for (const d of sink) diagnostics.push(tag(d, node.id, 'visibleIf'));
      if (!result.ok) {
        diagnostics.push(tag(result.error, node.id, 'visibleIf'));
        return { visible: false, diagnostics };
      }
      value = result.value;
    }
    return { visible: value !== undefined && isTruthy(value), diagnostics };
  } catch (error) {
    return fail(
      'visibility.internal',
      `evaluating visibleIf failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
