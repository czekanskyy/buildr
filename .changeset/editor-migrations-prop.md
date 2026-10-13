---
'@next-buildr/editor': minor
---

`EditorApp` takes an optional `migrations` prop (`registry.migrations`). A paste of content copied under older component versions, or of a retired type, is migrated first; without it, or if the migration fails, the paste is refused (`clipboard.outdated`) and nothing is inserted. Components inserted from the panel or by drag are stamped with the registry's versions, and select props show their `optionLabels`.
