# Testing rules for AI agents

See [../testing.md](../testing.md) for the full strategy and tooling matrix. This page is the quick-reference checklist for what a given change requires.

## What each kind of change requires

| Change | Required tests |
|---|---|
| A document-shape change | A migration, a `fixtures/migrations/` pair, a full-chain migration test, an updated `assertDocumentInvariants` test if invariants changed |
| A component prop-schema change | A migration, a migration fixture, an SSR snapshot update (reviewed, not blindly regenerated), a `version` bump |
| A new command | `validate`/`apply` unit tests, an undo/redo test, inclusion in the property-based command-sequence suite |
| A new `DataSource` implementation | The full shared contract test suite (see `packages/test-utils/src/contracts/data-source.ts`) |
| A new style property | A grammar test, a compiler snapshot test, an injection-attempt corpus test |
| A new expression function | Valid/invalid argument tests, inclusion in the fuzz corpus if it accepts a string argument |
| A Payload endpoint or hook | An integration test against Local API on SQLite (happy path, 401/403, 409/422 where relevant) |
| An editor feature that changes the document | An integration test asserting only commands were dispatched (never a direct store mutation), plus an undo/redo test |
| A new component | See the Definition of Done in [component-development.md](component-development.md) |

## Rules

- Never update a snapshot without reading the diff first. A snapshot update in a PR description should say what changed and why.
- Use a seeded ID generator (`createSeededIdGenerator`, from `@next-buildr/test-utils`) for deterministic fixtures — never rely on real random IDs in a test assertion.
- Use fake timers for anything involving autosave debouncing, coalescing windows, or retry backoff — never a real `sleep`.
- Payload integration tests run against SQLite in PR CI; the full Postgres matrix runs nightly only.
- Prefer selecting E2E elements by role/accessible name over CSS classes — this doubles as an accessibility check.
- `.only`/`.skip` must never land on `main`.
- A property-based test that finds a real bug gets a permanent regression test (the failing seed, pinned) in addition to the general property.
