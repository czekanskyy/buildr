import {
  type BuilderDocument,
  canMove,
  type DocumentIndex,
  type DropTarget,
  type NodeId,
  type Reason,
  type RegistryMeta,
  type Result,
} from '@next-buildr/core';

/**
 * `canMove` for a gap as `node.move` counts it (among the children as they are before the move).
 * `canMove` itself counts without the node being moved when it stays in its slot, so the end gap of
 * its own slot is one past what it accepts; the gap is clamped for the check, as the command does.
 */
export function moveVerdict(
  doc: BuilderDocument,
  index: DocumentIndex,
  registry: RegistryMeta,
  id: NodeId,
  target: DropTarget,
): Result<true, Reason> {
  const sameSlot = index.parentOf[id] === target.parentId && index.slotOf[id] === target.slot;
  const count = doc.nodes[target.parentId]?.slots?.[target.slot]?.length ?? 0;
  const at = sameSlot ? Math.min(target.index, Math.max(0, count - 1)) : target.index;
  return canMove(doc, index, registry, id, { parentId: target.parentId, slot: target.slot, at });
}
