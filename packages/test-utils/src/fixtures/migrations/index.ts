import type { MigrationFixture } from './types.ts';

export type { MigrationFixture } from './types.ts';

/**
 * The document-migration fixture corpus (see docs/migrations.md, PB-011): one `before`/`after`
 * pair per shipped document-shape migration, exercised by this directory's "fixture vN -> latest"
 * harness (`index.test.ts`). Empty until the document schema's first version bump ships a
 * migration alongside its fixture pair (see `core/src/migrations/document`).
 */
export const documentMigrationFixtures: readonly MigrationFixture[] = [];
