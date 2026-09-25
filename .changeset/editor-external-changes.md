---
"@buildr/editor": minor
---

Detect saves made elsewhere (PB-143): the optional `DocumentAdapter.getRevision(ref)` is checked every 30 s while the tab is visible and on window focus (`PersistenceController.checkExternal()`, `externalCheckMs`, `isVisible`). With an unchanged document `PersistenceState.external` drives a non-blocking status banner with a "Reload the latest version" button; with unsaved changes the existing conflict dialog opens early. New message keys `external.banner`, `external.banner.by`, `external.reload`.
