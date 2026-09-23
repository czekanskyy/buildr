---
"@buildr/core": minor
---

Add component migrations and unknown-type handling (PB-017): `migrateComponents(doc, migrations)` walks `doc.components`, folding each node's props through the registry's declared step chain (`ComponentMigrationEntry { currentVersion, steps }`) and bumping the version map to match. A type absent from `migrations` is left untouched and reported via `diagnostics` (`component.unknown-type`); a type stored at a version newer than the registry knows, or whose step chain can't reach it, is left untouched and reported via `readOnlyReasons` — the document should be treated as read-only while that's non-empty rather than silently downgraded or corrupted. Each step's `migrate` receives a `ComponentMigrationContext` scoped to the node's own subtree only, never the whole document.
