import type { LocaleConfig } from '@next-buildr/core';
import {
  type BuilderDocument,
  createEmptyDocument,
  DEFAULT_DOCUMENT_LIMITS,
  type Diagnostic,
  type DocumentLimits,
  migrateComponents,
  migrateDocument,
  parseDocument,
  type RawDocument,
  validateDocument,
} from '@next-buildr/core';
import type { BuildrRegistry } from '../options.ts';

export interface ProcessLayoutOptions {
  readonly registry?: BuildrRegistry | undefined;
  readonly limits: { readonly maxNodes: number; readonly maxBytes: number };
  /** The languages of the site: an `l10n` key outside them is reported (a warning, kept). */
  readonly locales?: LocaleConfig | undefined;
}

export type ProcessedLayout =
  | { readonly ok: true; readonly doc: BuilderDocument; readonly warnings: readonly Diagnostic[] }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] };

/** The limits of the plugin can only tighten the defaults of the model. */
export const documentLimits = (limits: ProcessLayoutOptions['limits']): DocumentLimits => ({
  ...DEFAULT_DOCUMENT_LIMITS,
  maxNodes: Math.min(limits.maxNodes, DEFAULT_DOCUMENT_LIMITS.maxNodes),
  maxDocumentBytes: Math.min(limits.maxBytes, DEFAULT_DOCUMENT_LIMITS.maxDocumentBytes),
});

const failure = (code: string, message: string): ProcessedLayout => ({
  ok: false,
  diagnostics: [{ code, message, severity: 'error' }],
});

/**
 * What every write of `layout` goes through, whatever its path (Local API, REST, the builder
 * endpoints): a missing document becomes an empty one; anything else is migrated to the current
 * document schema, parsed against the limits, migrated to the current component versions and, when
 * a registry is configured, validated. Errors reject the write; warnings are handed back to be logged.
 */
export function processLayout(value: unknown, options: ProcessLayoutOptions): ProcessedLayout {
  if (value === undefined || value === null) {
    return { ok: true, doc: createEmptyDocument(), warnings: [] };
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return failure('layout.not-an-object', 'the layout must be a document object');
  }
  const raw = value as { schemaVersion?: unknown };
  if (typeof raw.schemaVersion !== 'number') {
    return failure('layout.no-schema-version', 'the layout has no numeric "schemaVersion"');
  }
  const limits = documentLimits(options.limits);

  const migratedShape = migrateDocument(value as RawDocument);
  if (!migratedShape.ok) return { ok: false, diagnostics: [migratedShape.error] };

  const parsed = parseDocument(migratedShape.value.doc, limits);
  if (!parsed.ok) return { ok: false, diagnostics: parsed.error };

  let doc = parsed.value;
  const warnings: Diagnostic[] = [];
  const registry = options.registry;
  if (registry?.migrations !== undefined) {
    const migrated = migrateComponents(doc, registry.migrations);
    if (migrated.readOnlyReasons.length > 0) {
      return { ok: false, diagnostics: migrated.readOnlyReasons };
    }
    warnings.push(...migrated.diagnostics);
    doc = migrated.doc;
  }
  if (registry !== undefined) {
    const result = validateDocument(doc, {
      registry: registry.meta,
      limits,
      locales: options.locales,
    });
    const errors = result.issues.filter((issue) => issue.severity === 'error');
    if (!result.ok || errors.length > 0) return { ok: false, diagnostics: errors };
    warnings.push(...result.issues);
  }
  return { ok: true, doc, warnings };
}

/** A readable one-line-per-problem message for the admin UI (`code` and, when known, where). */
export function describeDiagnostics(diagnostics: readonly Diagnostic[]): string {
  return diagnostics
    .map((diagnostic) => {
      const where = diagnostic.path === undefined ? '' : ` (${diagnostic.path.join('.')})`;
      return `${diagnostic.message}${where}`;
    })
    .join('; ');
}
