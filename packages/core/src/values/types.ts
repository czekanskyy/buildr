// `LocaleCode`, `FormatSpec`, `StaticValue`, `BindingValue`, `ExpressionValue`, and `Value` are
// defined in `document/types.ts` (L1), not here (L3) - `PageNode.props` needs the `Value` shape
// and `document` must stay self-contained (architecture-rules.md). This module re-exports them
// as part of `@buildr/core/values`'s public surface, alongside the types that belong here.
import type { LocaleCode, Value } from '../document/types.ts';

export type {
  BindingValue,
  ExpressionValue,
  FormatSpec,
  LocaleCode,
  StaticValue,
  Value,
} from '../document/types.ts';

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
 * A node's props once bindable — the narrowed `PageNode.props` shape anticipated by PB-006
 * (docs/document-model.md). Only props declared in the component's schema; a missing key means
 * "use the default".
 */
export type NodeProps = Readonly<Record<string, Value>>;
