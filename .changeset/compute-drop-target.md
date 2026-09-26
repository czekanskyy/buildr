---
"@next-buildr/core": minor
---

Add `computeDropTarget` (PB-043), the pure drag-and-drop algorithm: from a point, the hit path (`HitEntry[]` with rects, layout axis and child rects) and a `DragItem` (component, template or existing nodes) it returns the `DropTarget` `{ parentId, slot, index }`, the `DropIndicator` to draw, or `null` with the `Reason` for the refusal. Exports the geometry types (`Rect`, `Point`, `HitEntry`, `ChildRect`, `LayoutAxis`, `DropResult`, …).
