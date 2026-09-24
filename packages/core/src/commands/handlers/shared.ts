import type { DocumentIndex } from '../../document/document-index.ts';
import type { BuilderDocument, NodeId, PageNode, SlotName } from '../../document/types.ts';

/**
 * The ids that are not inside another listed node's subtree, in document order — acting on a
 * node acts on its descendants too, so listing both is redundant, not an error.
 */
export function topLevelIds(ids: readonly NodeId[], index: DocumentIndex): NodeId[] {
  const wanted = new Set(ids);
  const covered = (id: NodeId): boolean => {
    for (let p = index.parentOf[id]; p !== undefined; p = index.parentOf[p]) {
      if (wanted.has(p)) return true;
    }
    return false;
  };
  return [...wanted]
    .filter((id) => !covered(id))
    .sort((a, b) => index.order.indexOf(a) - index.order.indexOf(b));
}

/**
 * Placeholder ids for a rule check: a fragment given ids that cannot collide with the document,
 * so `canInsert` judges placement rather than mistaking a live subtree for a move into itself.
 */
export function placeholderIds(): () => string {
  let counter = 0;
  return () => `__check-${counter++}`;
}

/** A copy of `doc` in which `parentId`'s `slot` holds `children` — for checking a placement that has not happened yet. */
export function withSlot(
  doc: BuilderDocument,
  parentId: NodeId,
  slot: SlotName,
  children: readonly NodeId[],
): BuilderDocument {
  const parent = doc.nodes[parentId] as PageNode;
  return {
    ...doc,
    nodes: {
      ...doc.nodes,
      [parentId]: { ...parent, slots: { ...parent.slots, [slot]: children } },
    },
  };
}
