# Drag and drop

## Model

```ts
type DragItem =
  | { kind: 'component'; type: ComponentType }
  | { kind: 'template'; id: string; variant?: string }
  | { kind: 'nodes'; ids: NodeId[] };
interface DropTarget { parentId: NodeId; slot: SlotName; index: number }
interface DropResult { target: DropTarget | null; indicator?: { kind: 'line' | 'inside'; rect: Rect; axis: 'x' | 'y' }; reason?: Reason }
```

## The algorithm (`core/dnd/computeDropTarget`)

A pure function, tested with no DOM. Input: a point, a hit path from the deepest hit node up to root (`{ nodeId, rect, axis, childRects }`), the document, the registry, and a `DragItem`.

1. If the hit node has slots and the point falls inside its interior area (outside an edge zone of `min(12px, 25%)` of the relevant dimension), the target is **inside** that node. The insertion index is the nearest child along the layout axis; an empty slot gets index 0.
2. Otherwise the target is **before/after** the hit node, within its parent's slot. The axis comes from the parent's computed style (`flex-direction`; for `grid`, the nearest edge in 2D; for block layout, vertical).
3. If `canInsert` rejects the candidate target, walk up the hit path (checking ancestor edge zones) until an allowed target is found. If none exists, the result is `null` plus a `reason`.
4. Exclusions: dropping a node onto itself or a descendant, locked targets, and `slot.max` limits.

## Flows

- **Palette/tree -> canvas**: once the pointer enters the iframe, the editor overlays a transparent shield (pointer events stay in the editor), translates coordinates (iframe offset, zoom) and sends `dnd:over` once per frame. The canvas hit-tests, computes the target, draws the indicator, and replies `dnd:target`. On drop, the editor runs `node.insert` (a fragment from `instantiateTemplate` or from the component's `defaults`) at the last known target.
- **Moving inside the canvas**: a drag handle in the overlay. The runtime captures the pointer locally, computes the target with the same algorithm, and sends `intent:move` on drop, which the editor turns into `node.move`.
- **Layers panel**: the same engine, hit-testing tree rows by the cursor's indent depth.
- **Feedback**: a 2px accent-colored insertion line, container highlight for an "inside" drop, a forbidden state (a `not-allowed` cursor, a red indicator carrying the `reason` message), canvas autoscroll near edges, a labeled drag ghost.
- **Keyboard**: Alt+Up/Down moves a node among its siblings; a "Move to..." action opens a dialog with the tree.

See also the editor engine implementation notes in [editor.md](editor.md#drag-and-drop-1) and risk R1 in the [backlog](backlog/README.md#risks).
