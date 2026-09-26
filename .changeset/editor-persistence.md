---
"@next-buildr/editor": minor
---

Persistence (PB-087): the `DocumentAdapter` interface, `loadDocument` (validated, read-only aware), `createPersistence` (autosave state machine: debounce, max wait, single-flight saves, retry backoff, conflict handling with reload/overwrite), `<PersistenceProvider>` with a conflict dialog and a `beforeunload` warning, `<SaveStatus />` and `useSaveAction`. `BuilderEditorProps.adapter` is now a `DocumentAdapter`; `EditorStore.markSaved` takes an optional cursor id. Adds `zod` as a dependency of the editor (validation of backend replies at the boundary).
