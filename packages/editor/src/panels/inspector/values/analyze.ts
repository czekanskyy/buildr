import {
  compileExpression,
  compileTemplate,
  type DataContext,
  type DataSchema,
  type DataTypeTag,
  type Diagnostic,
  type FormatSpec,
  formatValue,
  type JsonValue,
  listPaths,
  resolveBinding,
  schemaAtPath,
  typecheck,
  type Value,
} from '@buildr/core';

/** How a formula is read: an expression, or free text with `{{ }}` segments. */
export type FormulaMode = 'formula' | 'template';

/** A field the binding picker offers. */
export interface BindingOption {
  readonly path: string;
  /** What the field resolves to (`string`, `date`, ...). */
  readonly tag: DataTypeTag;
  readonly label: string | undefined;
}

/** The fields of the data schema a prop can take, in schema order. Empty without a schema. */
export function bindingOptions(
  schema: DataSchema | undefined,
  accepts: readonly DataTypeTag[],
): BindingOption[] {
  if (schema === undefined || accepts.length === 0) return [];
  const paths = listPaths(schema, (type) => accepts.includes(type.t));
  const options: BindingOption[] = [];
  for (const path of paths) {
    const field = schemaAtPath(schema, path);
    if (field === undefined) continue;
    options.push({ path, tag: field.type.t, label: field.label });
  }
  return options;
}

/** Whether a binding path is fine, and if not, why. `unchecked` when there is no schema to check against. */
export type BindingStatus = 'ok' | 'missing' | 'type' | 'unchecked';

export function checkBinding(
  schema: DataSchema | undefined,
  path: string,
  accepts: readonly DataTypeTag[],
): BindingStatus {
  if (schema === undefined) return 'unchecked';
  const field = schemaAtPath(schema, path);
  if (field === undefined) return 'missing';
  return accepts.includes(field.type.t) ? 'ok' : 'type';
}

export interface FormulaCheck {
  /** Every problem, tagged with the span (`details.start` / `details.end`) it concerns. */
  readonly diagnostics: readonly Diagnostic[];
  /** No error (a warning does not stop a formula from being saved). */
  readonly valid: boolean;
}

/**
 * Parses and typechecks a formula against the schema and the prop's `accepts`, without running it.
 * An empty source is invalid (there is nothing to save).
 */
export function checkFormula(
  source: string,
  mode: FormulaMode,
  schema: DataSchema | undefined,
  accepts: readonly DataTypeTag[],
): FormulaCheck {
  if (source.trim() === '') {
    return {
      valid: false,
      diagnostics: [{ code: 'expr.empty', message: 'The formula is empty.', severity: 'error' }],
    };
  }
  const compiled = mode === 'template' ? compileTemplate(source) : compileExpression(source);
  if (!compiled.ok) return { valid: false, diagnostics: [compiled.error] };
  const checked = typecheck(compiled.value.ast, schema, mode === 'formula' ? { accepts } : {});
  return {
    diagnostics: checked.diagnostics,
    valid: !checked.diagnostics.some((diagnostic) => diagnostic.severity === 'error'),
  };
}

/** The `[start, end)` a diagnostic points at in the source, when it says. */
export function spanOf(
  diagnostic: Diagnostic,
): { readonly start: number; readonly end: number } | undefined {
  const start = diagnostic.details?.['start'];
  const end = diagnostic.details?.['end'];
  return typeof start === 'number' && typeof end === 'number' ? { start, end } : undefined;
}

export interface Preview {
  /** The value as text, `undefined` when there is nothing to show. */
  readonly text: string | undefined;
  readonly diagnostics: readonly Diagnostic[];
}

const show = (value: JsonValue | undefined): string | undefined => {
  if (value === undefined || value === null) return undefined;
  return typeof value === 'string' ? value : JSON.stringify(value);
};

/**
 * What a binding or formula gives against sample data: the resolved value, formatted when a format
 * is set. Never throws; a problem is a diagnostic and the text stays `undefined` (or the fallback).
 */
export function previewValue(value: Value, context: DataContext | undefined): Preview {
  if (context === undefined || value.kind === 'static') return { text: undefined, diagnostics: [] };
  if (value.kind === 'binding') {
    const resolved = resolveBinding(value, context);
    if (resolved.value === undefined) {
      return { text: undefined, diagnostics: resolved.diagnostics };
    }
    if (value.format === undefined) {
      return { text: show(resolved.value), diagnostics: resolved.diagnostics };
    }
    const formatted = formatValue(resolved.value, value.format, context);
    return formatted.ok
      ? { text: formatted.value, diagnostics: resolved.diagnostics }
      : { text: show(resolved.value), diagnostics: [...resolved.diagnostics, formatted.error] };
  }
  const compiled =
    value.mode === 'template' ? compileTemplate(value.expr) : compileExpression(value.expr);
  if (!compiled.ok)
    return { text: show(value.fallback as JsonValue | undefined), diagnostics: [compiled.error] };
  const result = compiled.value.evaluate(context);
  return result.ok
    ? { text: show(result.value), diagnostics: [] }
    : { text: show(value.fallback as JsonValue | undefined), diagnostics: [result.error] };
}

/** The format families the picker offers; `none` writes no format. */
export type FormatKind = 'none' | FormatSpec['type'];

export const FORMAT_KINDS: readonly FormatKind[] = ['none', 'date', 'number', 'currency', 'text'];

/** A fresh format of a kind, with the defaults the controls start from; `undefined` for `none`. */
export function defaultFormat(kind: FormatKind): FormatSpec | undefined {
  switch (kind) {
    case 'none':
      return undefined;
    case 'date':
      return { type: 'date', style: 'medium' };
    case 'number':
      return { type: 'number' };
    case 'currency':
      return { type: 'currency', currency: 'USD' };
    case 'text':
      return { type: 'text' };
  }
}

/** Whether a format applies to a field of this type (a date format on a date, and so on). */
export function formatKindsFor(tag: DataTypeTag | undefined): readonly FormatKind[] {
  switch (tag) {
    case 'date':
      return ['none', 'date'];
    case 'number':
      return ['none', 'number', 'currency'];
    case 'string':
    case 'enum':
    case 'url':
      return ['none', 'text'];
    case undefined:
      return FORMAT_KINDS;
    default:
      return ['none'];
  }
}
