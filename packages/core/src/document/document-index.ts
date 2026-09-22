import type { BuilderDocument, NodeId, PageNode, SlotName } from './types.ts';

/** One node's position in a pre-order walk of the tree — see `traverseFrames`. */
export interface TraversalFrame {
  readonly node: PageNode;
  readonly parentId: NodeId | undefined;
  readonly slot: SlotName | undefined;
  readonly slotIndex: number | undefined;
  readonly depth: number;
}

/**
 * Pre-order (render-order) walk of frames starting at `startId`, visited-set bounded so a cycle
 * or a doubly-parented node in a corrupted document can't cause an infinite loop or a duplicate
 * visit (see docs/document-model.md#invariants — this and `createIndex` tolerate a corrupted
 * document; `checkInvariants`, PB-009, is what reports it as an error). A dangling child ID
 * (missing from `doc.nodes`) is skipped rather than yielded.
 */
export function* traverseFrames(
  doc: BuilderDocument,
  startId: NodeId,
): Generator<TraversalFrame, void, void> {
  const startNode = doc.nodes[startId];
  if (!startNode) return;

  const visited = new Set<NodeId>();
  const stack: TraversalFrame[] = [
    { node: startNode, parentId: undefined, slot: undefined, slotIndex: undefined, depth: 0 },
  ];

  while (stack.length > 0) {
    const frame = stack.pop();
    if (!frame || visited.has(frame.node.id)) continue;
    visited.add(frame.node.id);
    yield frame;

    const slotEntries = Object.entries(frame.node.slots ?? {});
    // Push in reverse (both slots and each slot's children) so a LIFO stack pops them
    // left-to-right, matching render order.
    for (let s = slotEntries.length - 1; s >= 0; s--) {
      const entry = slotEntries[s];
      if (!entry) continue;
      const [slotName, children] = entry;
      for (let c = children.length - 1; c >= 0; c--) {
        const childId = children[c];
        if (childId === undefined || visited.has(childId)) continue;
        const childNode = doc.nodes[childId];
        if (!childNode) continue;
        stack.push({
          node: childNode,
          parentId: frame.node.id,
          slot: slotName,
          slotIndex: c,
          depth: frame.depth + 1,
        });
      }
    }
  }
}

/**
 * Derived parent/slot/depth relationships and document order for every node reachable from the
 * root (see docs/document-model.md — structure lives only in slot lists; this is the reusable,
 * memoized read side of it).
 */
export interface DocumentIndex {
  /** No entry for the root or for an unreachable node. */
  readonly parentOf: Readonly<Record<NodeId, NodeId>>;
  /** The slot name the node occupies on its parent. No entry for the root. */
  readonly slotOf: Readonly<Record<NodeId, SlotName>>;
  /** The node's position within its parent's slot array. No entry for the root. */
  readonly indexOf: Readonly<Record<NodeId, number>>;
  /** The root is 0. */
  readonly depthOf: Readonly<Record<NodeId, number>>;
  /** Every reachable node ID, pre-order (render order), root first. */
  readonly order: readonly NodeId[];
}

const indexCache = new WeakMap<Readonly<Record<NodeId, PageNode>>, DocumentIndex>();

/**
 * Builds (or returns the cached) `DocumentIndex` for `doc`. Memoized on `doc.nodes`'s identity —
 * commands produce a new `nodes` object on every change, so this is a same-reference cache hit
 * for repeated reads of an unchanged document and a full O(n) rebuild only when it actually
 * changed.
 */
export function createIndex(doc: BuilderDocument): DocumentIndex {
  const cached = indexCache.get(doc.nodes);
  if (cached) return cached;

  const parentOf: Record<NodeId, NodeId> = {};
  const slotOf: Record<NodeId, SlotName> = {};
  const indexOf: Record<NodeId, number> = {};
  const depthOf: Record<NodeId, number> = {};
  const order: NodeId[] = [];

  for (const frame of traverseFrames(doc, doc.root)) {
    order.push(frame.node.id);
    depthOf[frame.node.id] = frame.depth;
    if (frame.parentId !== undefined) parentOf[frame.node.id] = frame.parentId;
    if (frame.slot !== undefined) slotOf[frame.node.id] = frame.slot;
    if (frame.slotIndex !== undefined) indexOf[frame.node.id] = frame.slotIndex;
  }

  const index: DocumentIndex = { parentOf, slotOf, indexOf, depthOf, order };
  indexCache.set(doc.nodes, index);
  return index;
}
