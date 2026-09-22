// Public entry point of @buildr/test-utils: builders, fixtures, a seeded ID generator,
// DataSource contract tests, arbitraries, MemoryAdapter. Never published - workspace-only.
// Populated starting with docs/backlog/phase-01-core-document.md.

export type { DocOptions, NodeOptions, NodeTree } from './builders.ts';
export { doc, node } from './builders.ts';
export type { InvalidDocumentFixture } from './fixtures/documents/index.ts';
export { invalidDocumentFixtures, validDocumentFixtures } from './fixtures/documents/index.ts';
