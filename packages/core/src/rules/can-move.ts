import type { DocumentIndex } from '../document/document-index.ts';
import { extractFragment } from '../document/fragment.ts';
import { isAncestor } from '../document/traverse.ts';
import type { BuilderDocument, NodeId } from '../document/types.ts';
import type { RegistryMeta } from '../registry/registry.ts';
import { err, type Result } from '../result/index.ts';
import { evaluateInsertion, type InsertTarget } from './can-insert.ts';
import { isLocked } from './locks.ts';
import { type Reason, reason } from './reasons.ts';

/**
 * Whether `nodeId`'s subtree can be relocated to `target` — drag-and-drop reordering and the
 * "move" command (docs/component-registry.md#content-model-and-nesting-rules). The destination
 * side (slots, `parents`, the global content model, capabilities, `slot.max`, cycle prevention,
 * the destination's own lock) is `canInsert`'s own logic, run against `nodeId`'s live subtree as
 * a fragment; this additionally checks that the node is draggable and that its *current* location
 * isn't structurally locked.
 */
export function canMove(
  doc: BuilderDocument,
  index: DocumentIndex,
  registry: RegistryMeta,
  nodeId: NodeId,
  target: InsertTarget,
): Result<true, Reason> {
  if (nodeId === doc.root) {
    return err(reason('cannot-move-root', 'The document root cannot be moved.', { nodeId }));
  }

  const node = doc.nodes[nodeId];
  if (!node) {
    return err(reason('node-not-found', `Node "${nodeId}" does not exist.`, { nodeId }));
  }

  if (target.parentId === nodeId || isAncestor(doc, nodeId, target.parentId)) {
    return err(reason('cycle', 'A node cannot be moved inside its own subtree.', { nodeId }));
  }

  const meta = registry.get(node.type);
  if (meta?.capabilities?.draggable === false) {
    return err(reason('not-draggable', `${meta.label} cannot be moved.`, { type: node.type }));
  }

  const currentParentId = index.parentOf[nodeId];
  if (currentParentId !== undefined && isLocked(doc, index, currentParentId, 'structure')) {
    return err(
      reason('locked-structure', "This node's current location is structurally locked.", {
        nodeId,
        parentId: currentParentId,
      }),
    );
  }

  const isSameSlotReorder =
    currentParentId === target.parentId && index.slotOf[nodeId] === target.slot;

  const fragment = extractFragment(doc, [nodeId]);
  return evaluateInsertion(
    doc,
    index,
    registry,
    target,
    fragment,
    isSameSlotReorder ? nodeId : undefined,
  );
}
