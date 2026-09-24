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

## `computeDropTarget` in practice

```ts
computeDropTarget({ point, hitPath, doc, registry, item, maxEdgeZone? }): DropResult
```

`hitPath` runs from the deepest hit node up to the root. Each `HitEntry` is `{ nodeId, rect, axis, childRects, slotRects? }`: `axis` is how the node lays out its *own* children (`'x'` row, `'y'` column or block, `'grid'`), `childRects` are the rendered boxes of its children in order (a child with no box, hidden by a condition, is simply absent), and `slotRects` optionally gives the placeholder of each slot, empty ones included. All rects share one coordinate space — the editor has already applied zoom and the iframe offset. No DOM is needed.

- **Inside**: a node with slots whose interior contains the pointer (clear of an edge zone of `min(maxEdgeZone = 12, 25%)` per dimension) offers a gap in one of its slots: the slot whose placeholder is under the pointer, else the slot of the nearest child, else `default`. The index counts the rendered children that come before the pointer (centre before the pointer on the layout axis; on a grid, rows above, then boxes to the left on the same row). An empty slot gives index 0 and an `inside` indicator (highlight the container); otherwise the indicator is the 2px line at the gap.
- **Before / after**: the parent's axis decides. For a row or column, which half of the node the pointer is in; for a grid, the nearest of the four edges, which also sets the direction of the line.
- **Walking up**: candidates are tried deepest node first — inside, then before/after — and the first one `canInsert` (component, template) or `canMove` (every dragged node) accepts wins. Before/after is tried for the deepest node always, and for an ancestor only when the pointer is in its edge zone, so the indicator stays near the pointer.
- **Refusal**: when nothing is accepted, `target` is `null` and `reason` is the refusal of the *first* (closest) candidate — that is the message the forbidden state shows. Locks, `slot.max`, cycles and `draggable` all come from the rules.
- **The dragged node itself** offers nothing; hovering it drops into the container around it. A template is checked as a fragment of its variant (or default) tree.

The result is deterministic and the input is never modified.
