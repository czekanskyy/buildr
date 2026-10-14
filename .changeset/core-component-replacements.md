---
'@next-buildr/core': minor
---

Component migrations can now retire a component type: `ComponentMigrationEntry.replaces` maps a retired type to a `ComponentReplacement` that rewrites its nodes (type, props and styles) into the replacing type. `migrateComponents` plans each type together with the types it replaces and applies them as one unit, reporting `component.replacement-version-mismatch` when a retired type is stored at an unexpected version. The new `migrateFragment` runs the same migration over a fragment.

Also new: `fromTree` and `instantiateTemplate` take an optional `versions` map so new fragments carry the registry's component versions instead of always 1; `registryVersions(registry)` and `withRegistryVersions(fragment, registry)` are exported from the registry module; and `p.select` accepts an optional `optionLabels` (display label per option value), carried through the registry manifest.
