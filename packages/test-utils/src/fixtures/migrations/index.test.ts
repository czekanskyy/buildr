import { migrateDocument } from '@next-buildr/core';
import { describe, expect, it } from 'vitest';
import { documentMigrationFixtures } from './index.ts';

/**
 * The "fixture vN -> latest" harness (see docs/migrations.md, PB-011): every registered fixture's
 * `before` document must migrate to exactly its `after` document, and produce no diagnostics.
 * Vacuously passes today - the document schema is still at its first version (see ADR-014), so
 * there's no migration yet to exercise.
 */
describe('documentMigrationFixtures', () => {
  it('has no fixtures yet (document schema is still at its first version)', () => {
    expect(documentMigrationFixtures).toEqual([]);
  });

  it.each(documentMigrationFixtures.map((fixture) => [fixture.name, fixture] as const))(
    '%s migrates before -> after',
    (_name, fixture) => {
      const result = migrateDocument(fixture.before);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.doc).toEqual(fixture.after);
    },
  );
});
