import { describe, expect, it } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  documentMigrations,
  migrateDocument,
  type RawDocument,
} from './index.ts';

describe('migrateDocument', () => {
  it('returns a document already at the current version unchanged', () => {
    const raw: RawDocument = { schemaVersion: CURRENT_SCHEMA_VERSION, root: 'root', nodes: {} };

    const result = migrateDocument(raw);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.doc).toBe(raw);
    expect(result.value.applied).toEqual([]);
  });

  it('rejects a document newer than CURRENT_SCHEMA_VERSION with document.newer-version', () => {
    const raw: RawDocument = { schemaVersion: CURRENT_SCHEMA_VERSION + 1, root: 'root', nodes: {} };

    const result = migrateDocument(raw);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('document.newer-version');
    expect(result.error.details).toEqual({
      schemaVersion: CURRENT_SCHEMA_VERSION + 1,
      currentSchemaVersion: CURRENT_SCHEMA_VERSION,
    });
  });

  it('never mutates its input', () => {
    const raw: RawDocument = Object.freeze({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      root: 'root',
      nodes: Object.freeze({}),
    });

    expect(() => migrateDocument(raw)).not.toThrow();
    expect(raw).toEqual({ schemaVersion: CURRENT_SCHEMA_VERSION, root: 'root', nodes: {} });
  });
});

describe('acceptance criteria', () => {
  it('CURRENT_SCHEMA_VERSION matches the one BuilderDocument declares (docs/backlog PB-011)', () => {
    // BuilderDocument['schemaVersion'] is the literal type `1` (see document/types.ts) until the
    // schema's first version bump - kept in sync by hand until then.
    expect(CURRENT_SCHEMA_VERSION).toBe(1);
  });

  it("documentMigrations is empty pending the document schema's first version bump", () => {
    expect(documentMigrations).toEqual([]);
  });
});
