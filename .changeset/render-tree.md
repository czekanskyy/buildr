---
"@buildr/react": minor
---

Add `renderTree(doc, { registry, data, context, platform, instrument?, messages?, cache?, diagnostics? })` (PB-045), the one renderer for production and the canvas: walks the tree, resolves props and `visibleIf` with core, renders slots recursively, and creates each component with `root` attributes (`bc-<name> b-<id>`, the anchor as `id`) and no wrapper elements. Media props receive the prepared asset from `PreparedData.media`. Unknown components render nothing (or the canvas placeholder) and every problem is pushed onto the `diagnostics` sink. `CanvasInstrumentation` (`rootAttributes`, `NodeView`, `unknownComponent`, `emptySlot`) and `withNodeIds` are the canvas extension points; a dev-mode guard asserts client components receive serializable props.
