---
"@next-buildr/react": minor
---

Add `defineComponent` and `createRegistry` (PB-044): a component is its serializable metadata plus `render`, `runtime` and `migrations` (`{ [toVersion]: (props, ctx) => props }`, validated to be contiguous up to `version`). `createRegistry({ components, templates? })` builds an immutable `ReactRegistry` whose `meta` is a core `RegistryMeta` (so `toManifest`, `canInsert`, `validateDocument` see the metadata unchanged), with `get`/`has`/`list`, `migrations` for `migrateComponents`, and `extend`. Exports the component contract types `BuilderComponentProps`, `ClientComponentProps` (no `platform`), `NodeRoot`, `Platform`.
