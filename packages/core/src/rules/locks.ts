import type { DocumentIndex } from '../document/document-index.ts';
import type { BuilderDocument, NodeId } from '../document/types.ts';

/** Which `PageNode.lock` flag a check is asking about. */
export type LockAspect = 'structure' | 'content' | 'style';

/**
 * The nearest node at or above `startId` (inclusive) whose `lock[aspect]` is set — `undefined` if
 * none is (docs/templates.md#locks-and-regions). A structural check starts from the slot's parent
 * (the node whose slot list is actually changing); a content/style check starts from the node
 * being edited itself. Both are "walk up from the node this action touches".
 */
export function nearestLock(
  doc: BuilderDocument,
  index: DocumentIndex,
  startId: NodeId,
  aspect: LockAspect,
): NodeId | undefined {
  let current: NodeId | undefined = startId;
  while (current !== undefined) {
    if (doc.nodes[current]?.lock?.[aspect]) return current;
    current = index.parentOf[current];
  }
  return undefined;
}

/**
 * Whether some node from `startId` up to (but not including) `lockRootId` carries a `region`
 * marker — the escape hatch that reopens editing inside an otherwise locked subtree
 * (docs/templates.md#locks-and-regions), e.g. a Hero template's "Actions" button group.
 */
export function isWithinRegion(
  doc: BuilderDocument,
  index: DocumentIndex,
  lockRootId: NodeId,
  startId: NodeId,
): boolean {
  let current: NodeId | undefined = startId;
  while (current !== undefined && current !== lockRootId) {
    if (doc.nodes[current]?.region !== undefined) return true;
    current = index.parentOf[current];
  }
  return false;
}

/** Whether `aspect` is blocked at `startId`: locked by an ancestor and not reopened by a region. */
export function isLocked(
  doc: BuilderDocument,
  index: DocumentIndex,
  startId: NodeId,
  aspect: LockAspect,
): boolean {
  const lockRoot = nearestLock(doc, index, startId, aspect);
  if (lockRoot === undefined) return false;
  return !isWithinRegion(doc, index, lockRoot, startId);
}
