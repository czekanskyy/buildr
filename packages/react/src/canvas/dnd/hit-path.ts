import type {
  ChildRect,
  HitEntry,
  LayoutAxis,
  NodeId,
  Point,
  Rect,
  SlotName,
} from '@next-buildr/core';
import type { CanvasStore } from '../store.ts';

const rectOf = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, width: r.width, height: r.height };
};

/** How an element lays out its children, from its computed style (`display`, `flex-direction`). */
export function layoutAxisOf(
  style: Pick<CSSStyleDeclaration, 'display' | 'flexDirection'>,
): LayoutAxis {
  const { display } = style;
  if (display === 'grid' || display === 'inline-grid') return 'grid';
  if (display === 'flex' || display === 'inline-flex') {
    return style.flexDirection.startsWith('column') ? 'y' : 'x';
  }
  return 'y';
}

/** The `data-bid` elements one level below `el`, keyed by node id: the first repetition wins. */
function childElements(el: Element): Map<NodeId, Element> {
  const found = new Map<NodeId, Element>();
  for (const child of el.querySelectorAll('[data-bid]')) {
    const id = child.getAttribute('data-bid');
    if (id !== null && !found.has(id)) found.set(id, child);
  }
  return found;
}

function entryOf(doc: Document, el: Element, id: NodeId, store: CanvasStore): HitEntry {
  const view = doc.defaultView;
  const axis = view === null ? 'y' : layoutAxisOf(view.getComputedStyle(el));
  const node = store.getNode(id);
  const below = childElements(el);

  const childRects: ChildRect[] = [];
  for (const [slot, ids] of Object.entries(node?.slots ?? {}) as [SlotName, readonly NodeId[]][]) {
    for (const childId of ids) {
      const child = below.get(childId);
      // Only a child rendered directly for this node: a node deeper down that shares an id is not.
      if (child !== undefined && child.parentElement?.closest('[data-bid]') === el) {
        childRects.push({ nodeId: childId, slot, rect: rectOf(child) });
      }
    }
  }

  const slotRects: Record<SlotName, Rect> = {};
  for (const placeholder of el.querySelectorAll('[data-buildr-placeholder="empty-slot"]')) {
    const slot = placeholder.getAttribute('data-buildr-slot');
    if (slot !== null && placeholder.closest('[data-bid]') === el)
      slotRects[slot] = rectOf(placeholder);
  }

  return {
    nodeId: id,
    rect: rectOf(el),
    axis,
    childRects,
    ...(Object.keys(slotRects).length > 0 ? { slotRects } : {}),
  };
}

/**
 * The nodes under a point, deepest first up to the root, with what `computeDropTarget` needs of
 * each: its box, the way it lays out its children (read from the computed style) and the boxes of
 * its children and of its empty slots. The point is in the canvas viewport's coordinates.
 */
export function buildHitPath(doc: Document, point: Point, store: CanvasStore): HitEntry[] {
  const hit =
    typeof doc.elementsFromPoint === 'function' ? doc.elementsFromPoint(point.x, point.y) : [];
  let el: Element | null = null;
  for (const candidate of hit) {
    const owner = candidate.closest('[data-bid]');
    if (owner !== null) {
      el = owner;
      break;
    }
  }

  const path: HitEntry[] = [];
  const seen = new Set<NodeId>();
  for (; el !== null; el = el.parentElement?.closest('[data-bid]') ?? null) {
    const id = el.getAttribute('data-bid');
    if (id === null || seen.has(id) || store.getNode(id) === undefined) continue;
    seen.add(id);
    path.push(entryOf(doc, el, id, store));
  }
  return path;
}
