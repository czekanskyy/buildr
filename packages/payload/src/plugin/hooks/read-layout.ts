import {
  type BuilderDocument,
  createEmptyDocument,
  type Diagnostic,
  migrateComponents,
  migrateDocument,
  parseDocument,
  type RawDocument,
} from '@next-buildr/core';
import type { BuildrRegistry } from '../options.ts';
import { documentLimits, type ProcessLayoutOptions } from './process-layout.ts';

export type ReadLayout =
  | { readonly ok: true; readonly doc: BuilderDocument; readonly readOnly: boolean }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] };

/**
 * A stored layout as the editor opens it: migrated in memory (nothing is written), and marked
 * read-only when a component was written by newer code than this build knows (ADR-014).
 * Validation is not repeated here: a stored document was validated when it was written.
 */
export function readLayout(value: unknown, options: ProcessLayoutOptions): ReadLayout {
  if (value === undefined || value === null) {
    return { ok: true, doc: createEmptyDocument(), readOnly: false };
  }
  if (typeof value !== 'object' || typeof (value as RawDocument).schemaVersion !== 'number') {
    return {
      ok: false,
      diagnostics: [
        {
          code: 'layout.not-a-document',
          message: 'the stored layout is not a document',
          severity: 'error',
        },
      ],
    };
  }
  const migrated = migrateDocument(value as RawDocument);
  if (!migrated.ok) return { ok: false, diagnostics: [migrated.error] };
  const parsed = parseDocument(migrated.value.doc, documentLimits(options.limits));
  if (!parsed.ok) return { ok: false, diagnostics: parsed.error };

  const registry: BuildrRegistry | undefined = options.registry;
  if (registry?.migrations === undefined) return { ok: true, doc: parsed.value, readOnly: false };
  const components = migrateComponents(parsed.value, registry.migrations);
  return {
    ok: true,
    doc: components.readOnlyReasons.length > 0 ? parsed.value : components.doc,
    readOnly: components.readOnlyReasons.length > 0,
  };
}
