---
"@next-buildr/core": minor
---

Add the document migration framework (PB-011): `runMigrationChain` (`migrations/runner.ts`) is the generic forward-only chain runner; `migrateDocument(raw)` (`migrations/document`) walks a `RawDocument` from its stored `schemaVersion` up to `CURRENT_SCHEMA_VERSION` via `documentMigrations`, returning `Result<{ doc, applied }, Diagnostic>` and rejecting a newer-than-known version with `document.newer-version` (see ADR-014, docs/migrations.md). `documentMigrations` is empty and `CURRENT_SCHEMA_VERSION` is `1` pending the schema's first version bump.
