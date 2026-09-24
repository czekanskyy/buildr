import type { BuilderDocument, ComponentType, NodeId, SlotName } from '../document/types.ts';
import type { RegistryMeta } from '../registry/registry.ts';
import type { Reason } from '../rules/reasons.ts';

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A rectangle in one coordinate space (the canvas viewport, after the editor has translated for zoom and the iframe offset). */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** What is being dragged (docs/drag-and-drop.md#model). */
export type DragItem =
  | { readonly kind: 'component'; readonly type: ComponentType }
  | { readonly kind: 'template'; readonly id: string; readonly variant?: string }
  | { readonly kind: 'nodes'; readonly ids: readonly NodeId[] };

/** Where the dragged item would land: `index` is the gap position among the slot's current children. */
export interface DropTarget {
  readonly parentId: NodeId;
  readonly slot: SlotName;
  readonly index: number;
}

/**
 * How a node lays out its children: `x` (a row), `y` (a column, and ordinary block flow) or
 * `grid` (two-dimensional). The canvas derives it from the computed style (`display`,
 * `flex-direction`), so the algorithm needs no DOM.
 */
export type LayoutAxis = 'x' | 'y' | 'grid';

/** The rendered box of one child of a hit node, in slot order. */
export interface ChildRect {
  readonly nodeId: NodeId;
  readonly slot: SlotName;
  readonly rect: Rect;
}

/** One node on the path from the deepest hit node up to the root. */
export interface HitEntry {
  readonly nodeId: NodeId;
  readonly rect: Rect;
  /** How this node lays out its own children. */
  readonly axis: LayoutAxis;
  /** The rendered children, in slot order and document order within a slot. */
  readonly childRects: readonly ChildRect[];
  /** Placeholder boxes of slots, empty ones included, when the canvas draws them. */
  readonly slotRects?: Readonly<Record<SlotName, Rect>>;
}

/** The line or highlight the editor draws. */
export interface DropIndicator {
  /** `line` is a 2px insertion line; `inside` highlights an empty container that will receive the drop. */
  readonly kind: 'line' | 'inside';
  readonly rect: Rect;
  /** The direction siblings are ordered in: `y` means a horizontal line between stacked items. */
  readonly axis: 'x' | 'y';
}

export interface DropResult {
  /** `null` when nothing under the pointer accepts the item. */
  readonly target: DropTarget | null;
  readonly indicator?: DropIndicator;
  /** Why the deepest candidate was refused; set when `target` is `null`. */
  readonly reason?: Reason;
}

export interface ComputeDropTargetInput {
  readonly point: Point;
  /** From the deepest hit node up to the root. */
  readonly hitPath: readonly HitEntry[];
  readonly doc: BuilderDocument;
  readonly registry: RegistryMeta;
  readonly item: DragItem;
  /** The largest edge zone in pixels; default 12. */
  readonly maxEdgeZone?: number;
}
