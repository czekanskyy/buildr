# ADR-014: Schema migrations

**Status:** Accepted

## Context

Both the document shape (`schemaVersion`) and individual component prop schemas (`components[type]` version) will evolve. Documents already stored in production Payload instances must never be silently corrupted or lose data on an upgrade.

## Options

1. **No migration story** — rejected outright for a system meant to store real client data.
2. **Lazy, best-effort upgrades** — attractive for simplicity, but risks partial/ambiguous states when a migration is skipped or applied out of order.
3. **Forward-only, two-level, explicit migrations** — one chain for the document shape, one per component type for its prop schema, applied deterministically on write (and transiently, in-memory, on read) with an immutable, append-only history of migration functions.

## Decision**

Migrations are **forward-only** and **never modify a document's structure outside the declared `from`/`to` step**. Document-shape migrations live in `core/src/migrations/document`; component migrations live alongside each component's definition and run against `doc.components[type]`. A document whose component version is *newer* than what the running registry knows becomes read-only in the editor rather than being silently downgraded. Migrations run at write time (persisted) and, transparently, at read time in memory (not persisted) so an older stored document always renders correctly even before it's next saved.

## Consequences

- Released migrations are immutable — a bug in a migration is fixed by adding a *new* migration step, never by editing the old one, preserving reproducibility for every document ever written.
- A fixture corpus (`fixtures/migrations/v{n}/*.json`) is mandatory test infrastructure from the very first schema version.
- Newer-than-known documents degrade gracefully (read-only) instead of corrupting on save — critical for environments running a slightly older editor build against newer stored content.
