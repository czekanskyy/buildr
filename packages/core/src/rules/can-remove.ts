import type { DocumentIndex } from '../document/document-index.ts';
import type { BuilderDocument, NodeId } from '../document/types.ts';
import type { RegistryMeta } from '../registry/registry.ts';
import { err, ok, type Result } from '../result/index.ts';
import { isLocked } from './locks.ts';
import { type Reason, reason } from './reasons.ts';

/**
 * Whether `nodeId` can be removed from its parent slot — checks `capabilities.removable`, the
 * parent slot's `min` (removing it would leave too few children), and whether the parent's slot
 * is structurally locked (docs/component-registry.md#content-model-and-nesting-rules).
 */
export function canRemove(
  doc: BuilderDocument,
  index: DocumentIndex,
  registry: RegistryMeta,
  nodeId: NodeId,
): Result<true, Reason> {
  if (nodeId === doc.root) {
    return err(reason('cannot-remove-root', 'The document root cannot be removed.', { nodeId }));
  }

  const node = doc.nodes[nodeId];
  if (!node) {
    return err(reason('node-not-found', `Node "${nodeId}" does not exist.`, { nodeId }));
  }

  const meta = registry.get(node.type);
  if (meta?.capabilities?.removable === false) {
    return err(reason('not-removable', `${meta.label} cannot be removed.`, { type: node.type }));
  }

  const parentId = index.parentOf[nodeId];
  if (parentId === undefined) return ok(true); // unreachable from the root: nothing to protect

  if (isLocked(doc, index, parentId, 'structure')) {
    return err(
      reason('locked-structure', 'This node is inside a structurally locked section.', {
        nodeId,
        parentId,
      }),
    );
  }

  const parentNode = doc.nodes[parentId];
  const parentMeta = parentNode ? registry.get(parentNode.type) : undefined;
  const slotName = index.slotOf[nodeId];

  if (slotName !== undefined) {
    const slotDef = parentMeta?.slots?.[slotName];
    const currentCount = parentNode?.slots?.[slotName]?.length ?? 0;
    if (slotDef?.min !== undefined && currentCount - 1 < slotDef.min) {
      return err(
        reason('slot-min-violation', `"${slotName}" requires at least ${slotDef.min} item(s).`, {
          parentId,
          slot: slotName,
          min: slotDef.min,
        }),
      );
    }
  }

  return ok(true);
}
