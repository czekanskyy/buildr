import { createIndex, type DocumentIndex } from '../document/document-index.ts';
import type { BuilderFragment } from '../document/fragment.ts';
import { fromTree } from '../document/tree.ts';
import type { NodeId, SlotName } from '../document/types.ts';
import { createSeededIdGenerator } from '../ids/seeded-id-generator.ts';
import type { RegistryMeta } from '../registry/registry.ts';
import { err, ok, type Result } from '../result/index.ts';
import { canInsert } from '../rules/can-insert.ts';
import { canMove } from '../rules/can-move.ts';
import { type Reason, reason } from '../rules/reasons.ts';
import type {
  ComputeDropTargetInput,
  DragItem,
  DropIndicator,
  DropResult,
  DropTarget,
  HitEntry,
  LayoutAxis,
  Point,
  Rect,
} from './types.ts';

const DEFAULT_MAX_EDGE_ZONE = 12;
const LINE_THICKNESS = 2;

/** A candidate landing spot together with the line or highlight that shows it. */
interface Candidate {
  readonly target: DropTarget;
  readonly indicator: DropIndicator;
}

const contains = (rect: Rect, point: Point): boolean =>
  point.x >= rect.x &&
  point.x <= rect.x + rect.width &&
  point.y >= rect.y &&
  point.y <= rect.y + rect.height;

const centerX = (r: Rect): number => r.x + r.width / 2;
const centerY = (r: Rect): number => r.y + r.height / 2;

/** How far `point` is from `rect` (0 inside it). */
function distance(rect: Rect, point: Point): number {
  const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width));
  const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height));
  return Math.hypot(dx, dy);
}

/** The edge zone of a rect: `min(maxEdgeZone, 25%)` of each dimension. */
function edgeZones(rect: Rect, max: number): { x: number; y: number } {
  return { x: Math.min(max, rect.width * 0.25), y: Math.min(max, rect.height * 0.25) };
}

function inInterior(rect: Rect, point: Point, max: number): boolean {
  const zone = edgeZones(rect, max);
  return (
    point.x > rect.x + zone.x &&
    point.x < rect.x + rect.width - zone.x &&
    point.y > rect.y + zone.y &&
    point.y < rect.y + rect.height - zone.y
  );
}

/** A 2px line at `at`, spanning `span` on the other axis. `axis` is the direction siblings are ordered in. */
function line(axis: 'x' | 'y', at: number, span: Rect): DropIndicator {
  const half = LINE_THICKNESS / 2;
  return axis === 'y'
    ? {
        kind: 'line',
        axis,
        rect: { x: span.x, y: at - half, width: span.width, height: LINE_THICKNESS },
      }
    : {
        kind: 'line',
        axis,
        rect: { x: at - half, y: span.y, width: LINE_THICKNESS, height: span.height },
      };
}

const orderAxis = (axis: LayoutAxis): 'x' | 'y' => (axis === 'y' ? 'y' : 'x');

/** Whether a child box comes before `point` in the layout's order. */
function comesBefore(axis: LayoutAxis, child: Rect, point: Point): boolean {
  if (axis === 'x') return centerX(child) < point.x;
  if (axis === 'y') return centerY(child) < point.y;
  // A grid reads row by row: a box is before the point when it is on a row above, or on the same row and to the left.
  if (child.y + child.height <= point.y) return true;
  if (child.y > point.y) return false;
  return centerX(child) < point.x;
}

function chooseSlot(
  entry: HitEntry,
  point: Point,
  slots: readonly SlotName[],
): SlotName | undefined {
  if (slots.length === 0) return undefined;
  const placeholders = entry.slotRects;
  if (placeholders !== undefined) {
    for (const slot of slots) {
      const rect = Object.hasOwn(placeholders, slot) ? placeholders[slot] : undefined;
      if (rect !== undefined && contains(rect, point)) return slot;
    }
  }
  let best: { slot: SlotName; d: number } | undefined;
  for (const child of entry.childRects) {
    if (!slots.includes(child.slot)) continue;
    const d = distance(child.rect, point);
    if (best === undefined || d < best.d) best = { slot: child.slot, d };
  }
  if (best !== undefined) return best.slot;
  return slots.includes('default') ? 'default' : slots[0];
}

/** The gap to insert into when the pointer is inside `entry`. */
function insideCandidate(
  entry: HitEntry,
  point: Point,
  slots: readonly SlotName[],
  doc: ComputeDropTargetInput['doc'],
): Candidate | undefined {
  const slot = chooseSlot(entry, point, slots);
  if (slot === undefined) return undefined;

  const children = doc.nodes[entry.nodeId]?.slots?.[slot] ?? [];
  const rects = entry.childRects.filter((c) => c.slot === slot);
  const byId = new Map(rects.map((c) => [c.nodeId, c.rect]));
  const ordered = children.flatMap((id) => {
    const rect = byId.get(id);
    return rect === undefined ? [] : [{ id, rect }];
  });

  let gap = 0;
  for (const child of ordered) {
    if (comesBefore(entry.axis, child.rect, point)) gap++;
  }
  // `gap` counts rendered children; map it back to a position among all of the slot's children
  // (a child with no box, e.g. hidden by a condition, sits where it is in the list).
  const index = gap === 0 ? 0 : children.indexOf(ordered[gap - 1]?.id ?? '') + 1;
  const target: DropTarget = { parentId: entry.nodeId, slot, index };
  const axis = orderAxis(entry.axis);

  if (ordered.length === 0) {
    const placeholder =
      entry.slotRects !== undefined && Object.hasOwn(entry.slotRects, slot)
        ? entry.slotRects[slot]
        : undefined;
    return { target, indicator: { kind: 'inside', axis, rect: placeholder ?? entry.rect } };
  }

  const after = ordered[gap - 1];
  const before = ordered[gap];
  const indicator =
    after !== undefined
      ? line(
          axis,
          axis === 'y' ? after.rect.y + after.rect.height : after.rect.x + after.rect.width,
          after.rect,
        )
      : line(
          axis,
          axis === 'y' ? (before?.rect.y ?? entry.rect.y) : (before?.rect.x ?? entry.rect.x),
          before?.rect ?? entry.rect,
        );
  return { target, indicator };
}

/** Before or after `entry` among its siblings, on the side of the parent's layout the pointer is nearer to. */
function siblingCandidate(
  entry: HitEntry,
  parent: HitEntry | undefined,
  point: Point,
  index: DocumentIndex,
): Candidate | undefined {
  const parentId = index.parentOf[entry.nodeId];
  const slot = index.slotOf[entry.nodeId];
  const position = index.indexOf[entry.nodeId];
  if (parentId === undefined || slot === undefined || position === undefined) return undefined;

  const layout: LayoutAxis = parent?.axis ?? 'y';
  const rect = entry.rect;
  let after: boolean;
  let axis: 'x' | 'y';
  if (layout === 'grid') {
    // The nearest of the four edges decides both the side and the line's direction.
    const edges = [
      { d: point.x - rect.x, after: false, axis: 'x' as const },
      { d: rect.x + rect.width - point.x, after: true, axis: 'x' as const },
      { d: point.y - rect.y, after: false, axis: 'y' as const },
      { d: rect.y + rect.height - point.y, after: true, axis: 'y' as const },
    ];
    const nearest = edges.reduce((a, b) => (b.d < a.d ? b : a));
    after = nearest.after;
    axis = nearest.axis === 'x' ? 'x' : 'y';
  } else {
    axis = layout;
    after = layout === 'x' ? point.x > centerX(rect) : point.y > centerY(rect);
  }

  const target: DropTarget = { parentId, slot, index: after ? position + 1 : position };
  const edge =
    axis === 'y' ? (after ? rect.y + rect.height : rect.y) : after ? rect.x + rect.width : rect.x;
  return { target, indicator: line(axis, edge, rect) };
}

function templateFragment(
  item: Extract<DragItem, { kind: 'template' }>,
  registry: RegistryMeta,
): Result<BuilderFragment, Reason> {
  const def = registry.getTemplate(item.id);
  if (def === undefined) {
    return err(
      reason('unknown-component-type', `The template "${item.id}" does not exist.`, {
        template: item.id,
      }),
    );
  }
  const tree =
    item.variant !== undefined &&
    def.variants !== undefined &&
    Object.hasOwn(def.variants, item.variant)
      ? def.variants[item.variant]
      : def.tree;
  // Only the shape is checked, so throwaway ids are enough (and keep the result deterministic).
  return ok(fromTree(tree ?? def.tree, createSeededIdGenerator(1)));
}

/** Whether the dragged item may land at `target`; the first refusal otherwise. */
function verdict(
  input: ComputeDropTargetInput,
  index: DocumentIndex,
  target: DropTarget,
): Result<true, Reason> {
  const at = { parentId: target.parentId, slot: target.slot, at: target.index };
  const { item, doc, registry } = input;
  if (item.kind === 'component') return canInsert(doc, index, registry, at, item.type);
  if (item.kind === 'template') {
    const fragment = templateFragment(item, registry);
    return fragment.ok ? canInsert(doc, index, registry, at, fragment.value) : fragment;
  }
  if (item.ids.length === 0) {
    return err(reason('node-not-found', 'There is nothing to move.'));
  }
  for (const id of item.ids) {
    const checked = canMove(doc, index, registry, id, at);
    if (!checked.ok) return checked;
  }
  return ok(true);
}

/**
 * Where a drag would land, from the pointer position and the boxes under it
 * (docs/drag-and-drop.md). Pure and DOM-free: the canvas measures, this decides.
 *
 * Walking the hit path from the deepest node up, each node offers "inside" (when it has slots and
 * the pointer is clear of its edge zones) and "before/after" (always for the deepest node; for
 * an ancestor only when the pointer is in one of its edge zones). The first candidate
 * `canInsert`/`canMove` accepts wins. When none does, `target` is `null` and `reason` is the
 * first refusal — the one for the spot closest to the pointer — for the "not allowed" feedback.
 */
export function computeDropTarget(input: ComputeDropTargetInput): DropResult {
  const { point, hitPath, doc, registry, item } = input;
  const maxZone = input.maxEdgeZone ?? DEFAULT_MAX_EDGE_ZONE;
  const index = createIndex(doc);
  const dragged = new Set<NodeId>(item.kind === 'nodes' ? item.ids : []);

  let firstRefusal: Reason | undefined;
  const consider = (candidate: Candidate | undefined): DropResult | undefined => {
    if (candidate === undefined) return undefined;
    const checked = verdict(input, index, candidate.target);
    if (checked.ok) return { target: candidate.target, indicator: candidate.indicator };
    firstRefusal ??= checked.error;
    return undefined;
  };

  for (let level = 0; level < hitPath.length; level++) {
    const entry = hitPath[level];
    if (entry === undefined) continue;
    const node = doc.nodes[entry.nodeId];
    if (node === undefined) continue;
    // Hovering the node being dragged (or something inside it) offers nothing of its own.
    const isDragged = dragged.has(entry.nodeId);

    const slots = Object.keys(registry.get(node.type)?.slots ?? {});
    const interior = inInterior(entry.rect, point, maxZone);

    if (!isDragged && slots.length > 0 && interior) {
      const found = consider(insideCandidate(entry, point, slots, doc));
      if (found) return found;
    }
    if (!isDragged && (level === 0 || !interior)) {
      const found = consider(siblingCandidate(entry, hitPath[level + 1], point, index));
      if (found) return found;
    }
  }

  return {
    target: null,
    reason: firstRefusal ?? reason('target-not-found', 'Nothing here accepts a drop.'),
  };
}
