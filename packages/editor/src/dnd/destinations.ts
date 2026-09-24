import {
  type BuilderDocument,
  createIndex,
  type DropTarget,
  type NodeId,
  type RegistryMeta,
} from '@buildr/core';
import { moveVerdict } from './check.ts';

export interface Destination {
  readonly target: DropTarget;
  /** The node the nodes would go into. */
  readonly parentId: NodeId;
  readonly slot: string;
}

/** Nodes with no ancestor in the list: moving a node moves what is inside it too. */
function topmost(doc: BuilderDocument, ids: readonly NodeId[]): NodeId[] {
  const index = createIndex(doc);
  const set = new Set(ids);
  return ids.filter((id) => {
    for (let up = index.parentOf[id]; up !== undefined; up = index.parentOf[up]) {
      if (set.has(up)) return false;
    }
    return true;
  });
}

/**
 * Every place the nodes could be moved to, in document order: the end of each slot of each node the
 * rules accept (`canMove` for each of them). The keyboard counterpart of dragging; the list is what
 * the "Move to" dialog shows. Never more than `limit` entries, so a huge document cannot make the
 * dialog huge.
 */
export function moveDestinations(
  doc: BuilderDocument,
  registry: RegistryMeta,
  ids: readonly NodeId[],
  limit = 200,
): Destination[] {
  const movable = topmost(
    doc,
    ids.filter((id) => id !== doc.root && Object.hasOwn(doc.nodes, id)),
  );
  if (movable.length === 0) return [];
  const index = createIndex(doc);
  const out: Destination[] = [];
  for (const parentId of index.order) {
    const node = doc.nodes[parentId];
    if (node === undefined) continue;
    const slots = new Set(['default', ...Object.keys(node.slots ?? {})]);
    for (const slot of slots) {
      const at = (node.slots?.[slot] ?? []).length;
      const target = { parentId, slot, index: at };
      if (!movable.every((id) => moveVerdict(doc, index, registry, id, target).ok)) continue;
      out.push({ target, parentId, slot });
      if (out.length >= limit) return out;
    }
  }
  return out;
}
