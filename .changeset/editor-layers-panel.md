---
"@buildr/editor": minor
---

The layers panel (PB-077): `<LayersPanel />` — a virtualized, fully keyboard-operable ARIA tree of the document with expand/collapse, rename, component labels from the manifest (`ManifestProvider`), lock / `visibleIf` / breakpoint / issue badges, a context menu (rename, duplicate, wrap, unwrap, delete) and selection and hover kept in step with the canvas. Adds a `ContextMenu` UI primitive (new dependency `@radix-ui/react-context-menu`, the same family as the other primitives).
