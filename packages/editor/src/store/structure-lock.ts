import { type BuilderDocument, createIndex, type NodeId } from '@next-buildr/core';

type Index = ReturnType<typeof createIndex>;

function lockedWith(doc: BuilderDocument, index: Index, id: NodeId): boolean {
  if (!Object.hasOwn(doc.nodes, id)) return false;
  let current: NodeId | undefined = id;
  while (current !== undefined) {
    const node = doc.nodes[current];
    if (node?.lock?.structure === true) return true;
    if (node?.region !== undefined) return false;
    current = index.parentOf[current];
  }
  return false;
}

/**
 * Whether the block itself, or a block it sits in, is locked for structure (a layer "Lock"). Core
 * checks `lock.structure` from a node's parent on, so a locked block could still be removed, moved
 * or duplicated by itself; the editor refuses those for the block as well (docs/editor.md#layers).
 * A lock above an editable `region` does not reach what is inside the region, as in the canvas host.
 */
export function isNodeStructureLocked(doc: BuilderDocument, id: NodeId): boolean {
  if (!Object.hasOwn(doc.nodes, id)) return false;
  return lockedWith(doc, createIndex(doc), id);
}

/** The ids among `ids` that `isNodeStructureLocked` holds for. The index is built once per call. */
export function structureLockedIds(doc: BuilderDocument, ids: readonly NodeId[]): NodeId[] {
  if (ids.length === 0) return [];
  const index = createIndex(doc);
  return ids.filter((id) => lockedWith(doc, index, id));
}

/**
 * Why the blocks are refused: `self` when one of them carries the lock, `inherited` when each is
 * only locked by a block it sits in (a lock stops at an editable `region`); `undefined` when none is locked.
 */
export function structureLockReason(
  doc: BuilderDocument,
  ids: readonly NodeId[],
): 'self' | 'inherited' | undefined {
  const locked = structureLockedIds(doc, ids);
  if (locked.length === 0) return undefined;
  return locked.some((id) => doc.nodes[id]?.lock?.structure === true) ? 'self' : 'inherited';
}
