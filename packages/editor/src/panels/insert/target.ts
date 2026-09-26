import {
  type BuilderDocument,
  type BuilderFragment,
  canInsert,
  createIndex,
  type InsertTarget,
  type NodeId,
  type Reason,
  type RegistryMeta,
} from '@next-buildr/core';

/** Where an insertion goes, or why nowhere works. */
export type Placement =
  | { readonly ok: true; readonly target: Required<InsertTarget> }
  | { readonly ok: false; readonly reason: Reason | undefined };

/**
 * The first position the palette can insert `what` at, for the current selection: inside the
 * selected node (each of its slots in order, at the end), else right after it, else after each
 * ancestor in turn. With no selection, inside the root. `canInsert` decides every candidate, so the
 * result is always a position the `node.insert` command will accept.
 */
export function placeInsertion(
  doc: BuilderDocument,
  registry: RegistryMeta,
  selectedId: NodeId | null,
  what: string | BuilderFragment,
): Placement {
  const index = createIndex(doc);
  let firstReason: Reason | undefined;

  const attempt = (target: Required<InsertTarget>): Placement | undefined => {
    const verdict = canInsert(doc, index, registry, target, what);
    if (verdict.ok) return { ok: true, target };
    firstReason ??= verdict.error;
    return undefined;
  };

  const inside = (id: NodeId): Placement | undefined => {
    const node = Object.hasOwn(doc.nodes, id) ? doc.nodes[id] : undefined;
    if (node === undefined) return undefined;
    const slots = Object.keys(registry.get(node.type)?.slots ?? {});
    for (const slot of slots) {
      const found = attempt({ parentId: id, slot, at: node.slots?.[slot]?.length ?? 0 });
      if (found !== undefined) return found;
    }
    return undefined;
  };

  const start = selectedId !== null && Object.hasOwn(doc.nodes, selectedId) ? selectedId : doc.root;
  const inner = inside(start);
  if (inner !== undefined) return inner;

  // Not inside: after the selection, then after each ancestor (the guard stops a corrupt cycle).
  let current: NodeId | undefined = start;
  for (let hops = 0; current !== undefined && hops < 10_000; hops++) {
    const parentId: NodeId | undefined = index.parentOf[current];
    const slot = index.slotOf[current];
    const position = index.indexOf[current];
    if (parentId === undefined || slot === undefined || position === undefined) break;
    const found = attempt({ parentId, slot, at: position + 1 });
    if (found !== undefined) return found;
    current = parentId;
  }
  return { ok: false, reason: firstReason };
}
