---
"@next-buildr/editor": minor
---

Drag-and-drop engine (PB-086): `createDragEngine` (idle → pending → dragging with a 4 px threshold, drops through `node.insert` / `node.move`), `<DragProvider>` (shield over the canvas iframe, ghost, Escape, live region), drag sources for the palette and the layers tree (`useDragSource`, `useDragPress`), tree hit-testing (`treeDropTarget`), autoscroll, coordinate translation for the canvas (`toCanvasPoint`), and a keyboard "Move to…" dialog (`MoveToDialog`, `moveDestinations`).
