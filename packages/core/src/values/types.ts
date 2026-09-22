/** BCP-47-ish locale identifier, e.g. `"en"`, `"pl"`, `"en-US"` (see docs/i18n.md). */
export type LocaleCode = string;

/**
 * Localization configuration for a site (see
 * docs/i18n.md#model-shared-structure-localized-content). In the Payload integration this comes
 * from `config.localization`; in the playground, from the application's own configuration.
 */
export interface LocaleConfig {
  readonly locales: readonly LocaleCode[];
  readonly default: LocaleCode;
  readonly fallback: boolean;
  /** Per-locale display names for the editor's locale switcher, e.g. `{ en: 'English', pl: 'Polski' }`. */
  readonly intl: Readonly<Record<LocaleCode, string>>;
}

/**
 * How a resolved value is coerced/displayed (see
 * docs/dynamic-bindings.md#the-value-model). Applied during resolution, after the raw value is
 * read off a `binding` or produced by an `expression`.
 */
export type FormatSpec =
  | { readonly type: 'date'; readonly style: 'short' | 'medium' | 'long' | 'iso' }
  | {
      readonly type: 'number';
      readonly minimumFractionDigits?: number | undefined;
      readonly maximumFractionDigits?: number | undefined;
      readonly style?: 'decimal' | 'percent' | undefined;
    }
  | { readonly type: 'currency'; readonly currency: string }
  | {
      readonly type: 'text';
      readonly transform?: 'upper' | 'lower' | 'capitalize' | undefined;
      readonly truncate?: number | undefined;
    };

/**
 * A value fixed at authoring time (see docs/dynamic-bindings.md#the-value-model). Deliberately
 * wrapped rather than being a bare `T` — this keeps the union explicit and unambiguous when
 * parsing untrusted JSON, and keeps a resolver's `switch (value.kind)` the single dispatch point
 * everywhere (ADR-004).
 */
export interface StaticValue<T = unknown> {
  readonly kind: 'static';
  readonly value: T;
  /** Per-locale overrides (docs/i18n.md); `value` is the default-locale value. */
  readonly l10n?: Readonly<Partial<Record<LocaleCode, T>>> | undefined;
}

/**
 * A value sourced from the data tree at render time (see
 * docs/dynamic-bindings.md#the-value-model). Covers roughly 90% of real cases: picking a field
 * off the data tree, simple type checking, easy path refactors during migrations.
 */
export interface BindingValue<T = unknown> {
  readonly kind: 'binding';
  /** `a.b.c` segments and `[n]` numeric-literal indices (docs/dynamic-bindings.md#resolution). */
  readonly path: string;
  readonly format?: FormatSpec | undefined;
  readonly fallback?: T | undefined;
}

/**
 * A formula or text template evaluated at render time (see
 * docs/dynamic-bindings.md#the-value-model, docs/expressions.md). `mode: 'template'` is free text
 * with `{{ ... }}` segments interpolated; the default (`'formula'`) is a single expression.
 */
export interface ExpressionValue<T = unknown> {
  readonly kind: 'expression';
  readonly expr: string;
  readonly mode?: 'formula' | 'template' | undefined;
  /** Template-mode only (docs/i18n.md) — a per-locale override of the template source. */
  readonly l10n?: Readonly<Partial<Record<LocaleCode, string>>> | undefined;
  readonly fallback?: T | undefined;
}

/**
 * The static/binding/expression value model (see docs/dynamic-bindings.md#the-value-model,
 * ADR-004) — the type of every prop declared `bindable` in its `PropDef`. The discriminator is
 * `kind`, not `type`, to avoid confusion with `node.type`.
 */
export type Value<T = unknown> = StaticValue<T> | BindingValue<T> | ExpressionValue<T>;

/**
 * A node's props once bindable — the narrowed `PageNode.props` shape anticipated by PB-006
 * (docs/document-model.md). Only props declared in the component's schema; a missing key means
 * "use the default".
 */
export type NodeProps = Readonly<Record<string, Value>>;
