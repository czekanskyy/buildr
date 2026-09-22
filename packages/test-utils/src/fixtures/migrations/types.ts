import type { RawDocument } from '@buildr/core';

/** One document-migration fixture: `before` at version N, `after` at N+1 or at latest (see docs/migrations.md). */
export interface MigrationFixture {
  readonly name: string;
  readonly before: RawDocument;
  readonly after: RawDocument;
}
