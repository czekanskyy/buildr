---
"@buildr/editor": minor
---

The insert panel (PB-078): `<InsertPanel />` — a searchable palette of the manifest's components and templates, grouped by category, that inserts with a click or Enter (no drag and drop needed) at the first position `canInsert` allows: inside the selected container, else after the selection (or an ancestor), and says why when nothing fits. `placeInsertion` is exported for reuse (clipboard, shortcuts). `EditorStore` now exposes its `registry`.
