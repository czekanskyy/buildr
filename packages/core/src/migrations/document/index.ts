import type { Diagnostic } from '../../result/diagnostic.ts';
import { err, ok, type Result } from '../../result/result.ts';
import { type MigrationStep, runMigrationChain } from '../runner.ts';

/**
 * A document exactly as stored or received — its `schemaVersion` may be older than
 * `CURRENT_SCHEMA_VERSION`, so nothing beyond that field is trusted to match `BuilderDocument`
 * yet (see ADR-014, docs/migrations.md). Validate the migrated result with `parseDocument` before
 * treating it as one.
 */
export interface RawDocument {
  readonly schemaVersion: number;
  readonly [key: string]: unknown;
}

export type DocumentMigration = MigrationStep<RawDocument>;

/** The document schema version this build reads and writes (see ADR-014). */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * The document-shape migration chain, ordered by `from` (see docs/migrations.md). Empty until the
 * document schema's first version bump ships alongside its `fixtures/migrations/` pair — see
 * `packages/test-utils/src/fixtures/migrations`.
 */
export const documentMigrations: readonly DocumentMigration[] = [];

export interface MigrateDocumentResult {
  readonly doc: RawDocument;
  readonly applied: readonly DocumentMigration[];
}

/**
 * Walks `raw` from its stored `schemaVersion` up to `CURRENT_SCHEMA_VERSION` via
 * `documentMigrations` (see ADR-014). A document newer than this build knows how to read is
 * rejected with `document.newer-version` instead of being silently downgraded or corrupted. Never
 * mutates `raw`; a document already at the current version comes back unchanged, `applied: []`.
 */
export function migrateDocument(raw: RawDocument): Result<MigrateDocumentResult, Diagnostic> {
  if (raw.schemaVersion > CURRENT_SCHEMA_VERSION) {
    return err({
      code: 'document.newer-version',
      message: `the document's schema version ${raw.schemaVersion} is newer than the ${CURRENT_SCHEMA_VERSION} this build knows`,
      severity: 'error',
      details: { schemaVersion: raw.schemaVersion, currentSchemaVersion: CURRENT_SCHEMA_VERSION },
    });
  }

  const result = runMigrationChain(
    raw,
    raw.schemaVersion,
    CURRENT_SCHEMA_VERSION,
    documentMigrations,
  );
  if (!result.ok) return result;
  return ok({ doc: result.value.value, applied: result.value.applied });
}
