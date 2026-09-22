import type { JsonValue } from '../json/json-value.ts';

/**
 * BCP-47-ish locale identifier, e.g. `"en"`, `"pl"`, `"en-US"` (see docs/i18n.md). Defined here
 * (L1) rather than in `values/` (L3) because `PageNode.props` needs the `Value` shape below and
 * `document` must stay self-contained (architecture-rules.md); `@buildr/core/values` re-exports
 * it as part of its public surface.
 */
export type LocaleCode = string;

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

/** `root`, or a random 10-character base62 string minted by `generateId` (see docs/document-model.md). */
export type NodeId = string;

/** `<namespace>/<name>`, e.g. `buildr/heading`, `acme/pricing-table`. */
export type ComponentType = string;

/** A slot key on a node; `default` holds a node's ordinary children. */
export type SlotName = string;

/** The fixed component type of the document root (see docs/document-model.md#invariants). */
export const ROOT_COMPONENT_TYPE: ComponentType = 'buildr/page';

/**
 * The canonical, normalized document shape (see docs/document-model.md, ADR-002). Props are
 * typed `Value` as of PB-013; styles remain `unknown` until the `NodeStyles` shape lands in
 * PB-027.
 */
export interface BuilderDocument {
  readonly schemaVersion: 1;
  readonly root: 'root';
  readonly nodes: Readonly<Record<NodeId, PageNode>>;
  readonly components: Readonly<Record<ComponentType, number>>;
  readonly meta?: Readonly<{ readonly createdWith?: string; readonly updatedWith?: string }>;
}

export interface PageNode {
  readonly id: NodeId;
  readonly type: ComponentType;
  /** Only props declared in the component's schema; a missing key means "use the default". */
  readonly props?: Readonly<Record<string, Value>>;
  /** Order = render order. */
  readonly slots?: Readonly<Record<SlotName, readonly NodeId[]>>;
  /** Instance overrides only (see docs/styles.md). */
  readonly styles?: unknown;
  /** Layers-panel label. */
  readonly name?: string;
  /** HTML `id` attribute, unique in the document. */
  readonly anchor?: string;
  readonly visibleIf?: unknown;
  readonly lock?: Readonly<{
    readonly structure?: true;
    readonly content?: true;
    readonly style?: true;
  }>;
  /** An editable region inside a structurally locked subtree. */
  readonly region?: string;
  /** Provenance from a template (composite). */
  readonly source?: Readonly<{ readonly template: string; readonly version: number }>;
  /** Plugin extensions, namespaced keys e.g. `"acme:foo"`. */
  readonly ext?: Readonly<Record<string, JsonValue>>;
}
