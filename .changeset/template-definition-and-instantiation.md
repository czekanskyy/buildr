---
"@buildr/core": minor
---

Add composite templates (PB-018): `defineTemplate(input)` validates and returns a `TemplateDefinition` (duplicate `anchor`/`region` markers within the same tree, a well-formed `version`), throwing on an authoring mistake the way `createRegistryMeta` does. `instantiateTemplate(def, variant?, idGen)` builds a detached `BuilderFragment` from `def.tree` (or a named entry in `def.variants`) via `fromTree`, minting fresh IDs on every call and stamping the fragment root with `source: { template, version }` plus, when `def.lock === 'structure'`, a `lock.structure: true` flag layered on the root's own declared lock. `findLockRoot`/`isInsideRegion` walk a document to find the nearest structurally-locked ancestor and check whether a `region` marker reopens editing inside it (ADR-020, docs/templates.md) — implemented standalone in `templates` rather than reusing `rules`' internal equivalents, since both are peer L3 modules that may not import each other.
