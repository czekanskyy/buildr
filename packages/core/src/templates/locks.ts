import type { DocumentIndex } from '../document/document-index.ts';
import type { BuilderDocument, NodeId } from '../document/types.ts';

/**
 * The nearest node at or above `nodeId` (inclusive) whose `lock.structure` is set — `undefined` if
 * none is (docs/templates.md#locks-and-regions). A template instantiated with `lock: 'structure'`
 * carries that flag on its root (see `instantiateTemplate`), so this is how a structural command
 * (drag, paste, delete) finds the template boundary it needs to check against.
 *
 * Deliberately self-contained rather than reusing `rules/locks.ts`'s `nearestLock`: `rules` and
 * `templates` are peer L3 modules (docs/ai/architecture-rules.md), so neither may import the
 * other — see docs/ai/package-boundaries.md.
 */
export function findLockRoot(
  doc: BuilderDocument,
  index: DocumentIndex,
  nodeId: NodeId,
): NodeId | undefined {
  let current: NodeId | undefined = nodeId;
  while (current !== undefined) {
    if (doc.nodes[current]?.lock?.structure) return current;
    current = index.parentOf[current];
  }
  return undefined;
}

/**
 * Whether `nodeId` sits inside a `region` that reopens editing within an otherwise
 * `lock.structure`-protected subtree (docs/templates.md#locks-and-regions) — true when some node
 * from `nodeId` up to (but not including) its nearest `findLockRoot` carries a `region` marker,
 * and false when `nodeId` isn't inside a structurally locked subtree at all.
 */
export function isInsideRegion(
  doc: BuilderDocument,
  index: DocumentIndex,
  nodeId: NodeId,
): boolean {
  const lockRoot = findLockRoot(doc, index, nodeId);
  if (lockRoot === undefined) return false;

  let current: NodeId | undefined = nodeId;
  while (current !== undefined && current !== lockRoot) {
    if (doc.nodes[current]?.region !== undefined) return true;
    current = index.parentOf[current];
  }
  return false;
}
