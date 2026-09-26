# Phase 1: Core, the document model

## PB-006 - Core primitives - M

- **Purpose**: shared foundations for all of `core`.
- **Dependencies**: PB-002
- **Files**: `packages/core/src/{ids,json,result}/`
- **Implementation**: `generateId()` (base62, 10 characters, `crypto.getRandomValues`), `createSeededIdGenerator(seed)`; `JsonValue`, `isJsonValue`, `stableStringify`, `hash` (FNV-1a 64-bit -> base36); `Result` (`ok`/`err`), `Diagnostic`.
- **Tests**: no collisions across 1e6 generated IDs; the seeded generator is deterministic; `stableStringify` is independent of input key order; hash snapshots.
- **Acceptance criteria**: 100% coverage; zero runtime dependencies.
- **Risks**: none.

## PB-007 - Document types, the envelope schema, limits - M

- **Purpose**: the canonical document type and its validation (see `docs/document-model.md`).
- **Dependencies**: PB-006
- **Files**: `packages/core/src/document/{types,schema,limits,create,parse}.ts`
- **Implementation**: types (props and styles typed as `unknown` until PB-013/PB-027 land); `documentSchema` (Zod); `createEmptyDocument()`; `parseDocument(unknown) -> Result<Doc, Diagnostic[]>` enforcing a byte-size limit and configurable limits.
- **Tests**: a valid/invalid fixture corpus (bad ID format, missing root, exceeded limits, wrong component type).
- **Acceptance criteria**: every invalid case yields a specific diagnostic code; validating 5000 nodes takes under 20ms.
- **Risks**: Zod performance on large maps — fallback plan: hand-written loop-based validation.

## PB-008 - `DocumentIndex` and tree traversal - M

- **Purpose**: parent/child relationships and tree walking.
- **Dependencies**: PB-007
- **Files**: `packages/core/src/document/{index,traverse}.ts`
- **Implementation**: `createIndex(doc) -> { parentOf, slotOf, indexOf, depthOf, order }`, memoized (a `WeakMap` keyed on `doc.nodes`); `walk`, `ancestors`, `descendants`, `subtreeIds`, `isAncestor`, `pathTo`.
- **Tests**: deep and wide trees, memoization, a 5000-node benchmark under 2ms.
- **Acceptance criteria**: 95% coverage.
- **Risks**: none.

## PB-009 - Invariants and the fixture corpus - M

- **Purpose**: detecting corrupted documents, and shared test data.
- **Dependencies**: PB-008
- **Files**: `packages/core/src/document/invariants.ts`, `packages/test-utils/src/{builders.ts,fixtures/documents/**}`
- **Implementation**: `checkInvariants(doc) -> Diagnostic[]`, `assertDocumentInvariants` (dev-only); builders `doc()`, `node()`; at least 20 invalid fixtures (orphans, cycles, double parenting, a mismatched map key, a duplicate anchor).
- **Tests**: every invalid case yields the expected code; a valid document yields zero diagnostics.
- **Acceptance criteria**: builders are exported from `@next-buildr/test-utils`.
- **Risks**: none.

## PB-010 - The authoring format, fragments, `reId` - M

- **Purpose**: templates, the clipboard, and subtree insertion (see `docs/document-model.md`).
- **Dependencies**: PB-008
- **Files**: `packages/core/src/document/{tree,fragment}.ts`
- **Implementation**: `fromTree`, `toTree`, `extractFragment(doc, ids)`, `reId(fragment, idGen)`, `fragmentSchema` (Zod, for clipboard validation).
- **Tests**: round-trip `toTree(fromTree(t))`; `reId` preserves structure; a fragment with multiple roots.
- **Acceptance criteria**: a fragment inserted into a document passes `checkInvariants`.
- **Risks**: none.

## PB-011 - The document migration framework - M

- **Purpose**: evolving `schemaVersion` without data loss (see ADR-014).
- **Dependencies**: PB-007
- **Files**: `packages/core/src/migrations/{document/index,runner}.ts`, `packages/test-utils/src/fixtures/migrations/`
- **Implementation**: `DocumentMigration { from, to, migrate }`, a chain runner, `migrateDocument(raw) -> Result<{ doc, applied }>`, `CURRENT_SCHEMA_VERSION`, rejecting newer-than-known versions (`document.newer-version`), a "fixture vN -> latest" test harness.
- **Tests**: a test migration chain v1 -> v3; idempotency; input immutability.
- **Acceptance criteria**: a section is added to `docs/migrations.md`.
- **Risks**: none.
