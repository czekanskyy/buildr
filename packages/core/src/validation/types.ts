import type { DataSchema } from '../data/schema.ts';
import type { DocumentLimits } from '../document/limits.ts';
import type { BuilderDocument } from '../document/types.ts';
import type { RegistryMeta } from '../registry/registry.ts';
import type { Diagnostic } from '../result/diagnostic.ts';
import type { Theme } from '../styles/theme.ts';
import type { LocaleConfig } from '../values/types.ts';

/**
 * One finding of `validateDocument`. `severity` says how bad it is; `blocking` says whether it
 * must stop the document from being saved, published or rendered at all — a corrupt structure or
 * a document written by newer code. Everything else (an invalid prop value, an unknown token, a
 * missing translation) is reported but the document still renders, with fallbacks.
 */
export interface ValidationIssue extends Diagnostic {
  readonly blocking: boolean;
}

export interface ValidateDocumentOptions {
  readonly registry: RegistryMeta;
  /** Tokens and breakpoints for style checks; defaults to `defaultTheme`. */
  readonly theme?: Theme | undefined;
  /** Checks `l10n` keys against the configured languages. */
  readonly locales?: LocaleConfig | undefined;
  /** Checks bindings and expressions against the data shape. Skipped when absent. */
  readonly dataSchema?: DataSchema | undefined;
  readonly limits?: DocumentLimits | undefined;
}

export interface ValidationResult {
  /** True when nothing blocking was found (warnings and non-blocking errors may remain). */
  readonly ok: boolean;
  readonly issues: readonly ValidationIssue[];
  /** The parsed document, when its envelope was valid. */
  readonly doc: BuilderDocument | undefined;
}
