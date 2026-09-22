import type {
  BindingValue,
  ExpressionValue,
  FormatSpec,
  LocaleCode,
  StaticValue,
  Value,
} from './types.ts';

export function isStaticValue<T>(value: Value<T>): value is StaticValue<T> {
  return value.kind === 'static';
}

export function isBindingValue<T>(value: Value<T>): value is BindingValue<T> {
  return value.kind === 'binding';
}

export function isExpressionValue<T>(value: Value<T>): value is ExpressionValue<T> {
  return value.kind === 'expression';
}

export interface StaticValueOptions<T> {
  readonly l10n?: Readonly<Partial<Record<LocaleCode, T>>>;
}

/** Builds a `StaticValue` (docs/dynamic-bindings.md#the-value-model). */
export function s<T>(value: T, options: StaticValueOptions<T> = {}): StaticValue<T> {
  return {
    kind: 'static',
    value,
    ...(options.l10n !== undefined ? { l10n: options.l10n } : {}),
  };
}

export interface BindValueOptions<T> {
  readonly format?: FormatSpec;
  readonly fallback?: T;
}

/** Builds a `BindingValue` (docs/dynamic-bindings.md#the-value-model). */
export function bind<T = unknown>(
  path: string,
  options: BindValueOptions<T> = {},
): BindingValue<T> {
  return {
    kind: 'binding',
    path,
    ...(options.format !== undefined ? { format: options.format } : {}),
    ...(options.fallback !== undefined ? { fallback: options.fallback } : {}),
  };
}

export interface ExprValueOptions<T> {
  readonly mode?: 'formula' | 'template';
  readonly l10n?: Readonly<Partial<Record<LocaleCode, string>>>;
  readonly fallback?: T;
}

/** Builds an `ExpressionValue` (docs/dynamic-bindings.md#the-value-model, docs/expressions.md). */
export function expr<T = unknown>(
  source: string,
  options: ExprValueOptions<T> = {},
): ExpressionValue<T> {
  return {
    kind: 'expression',
    expr: source,
    ...(options.mode !== undefined ? { mode: options.mode } : {}),
    ...(options.l10n !== undefined ? { l10n: options.l10n } : {}),
    ...(options.fallback !== undefined ? { fallback: options.fallback } : {}),
  };
}

/**
 * Sets `locale`'s translation on a `static` value's `value`, or on a `template`-mode
 * `expression` value's `expr` source (docs/i18n.md#model-shared-structure-localized-content).
 * Throws for a `binding` value, or for an `expression` value not in `template` mode — `l10n`
 * isn't valid there (see `valueSchema`).
 */
export function withTranslation<T>(value: Value<T>, locale: LocaleCode, v: T | string): Value<T> {
  if (isStaticValue(value)) {
    return { ...value, l10n: { ...value.l10n, [locale]: v as T } };
  }
  if (isExpressionValue(value) && value.mode === 'template') {
    return { ...value, l10n: { ...value.l10n, [locale]: v as string } };
  }
  const modeSuffix = isExpressionValue(value) ? ` mode="${value.mode ?? 'formula'}"` : '';
  throw new Error(
    `withTranslation: l10n is only valid on a static value or a template-mode expression value (got "${value.kind}"${modeSuffix})`,
  );
}
