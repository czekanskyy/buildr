import type { BuilderDocument, NodeId, PageNode } from '@buildr/core';

/** One line of the layers tree. */
export interface LayerRow {
  readonly id: NodeId;
  readonly node: PageNode;
  readonly parentId: NodeId | null;
  /** 1 for the root (ARIA levels start at 1). */
  readonly level: number;
  /** Position among its parent's children, and how many there are (1-based, for `aria-posinset` / `aria-setsize`). */
  readonly posInSet: number;
  readonly setSize: number;
  readonly hasChildren: boolean;
  readonly expanded: boolean;
  /** The slot of the parent it sits in; `'default'` for the usual one. */
  readonly slot: string;
}

/** The children of a node in slot order, with the slot each is in; ids the document lacks are skipped. */
export function childrenWithSlots(
  doc: BuilderDocument,
  node: PageNode,
): { id: NodeId; slot: string }[] {
  const out: { id: NodeId; slot: string }[] = [];
  for (const [slot, ids] of Object.entries(node.slots ?? {})) {
    for (const id of ids) if (Object.hasOwn(doc.nodes, id)) out.push({ id, slot });
  }
  return out;
}

/**
 * The tree as the rows that are visible: a node's children follow it when it is expanded. Iterative
 * (a document may be deep) and guarded against a node reached twice, so a corrupt document cannot
 * loop it.
 */
export function flattenTree(doc: BuilderDocument, expanded: ReadonlySet<NodeId>): LayerRow[] {
  const rows: LayerRow[] = [];
  const seen = new Set<NodeId>();
  const root = doc.nodes[doc.root];
  if (root === undefined) return rows;

  type Frame = {
    id: NodeId;
    parentId: NodeId | null;
    level: number;
    pos: number;
    size: number;
    slot: string;
  };
  const stack: Frame[] = [
    { id: doc.root, parentId: null, level: 1, pos: 1, size: 1, slot: 'default' },
  ];
  while (stack.length > 0) {
    const frame = stack.pop() as Frame;
    if (seen.has(frame.id)) continue;
    seen.add(frame.id);
    const node = doc.nodes[frame.id];
    if (node === undefined) continue;
    const children = childrenWithSlots(doc, node);
    const open = children.length > 0 && expanded.has(frame.id);
    rows.push({
      id: frame.id,
      node,
      parentId: frame.parentId,
      level: frame.level,
      posInSet: frame.pos,
      setSize: frame.size,
      hasChildren: children.length > 0,
      expanded: open,
      slot: frame.slot,
    });
    if (open) {
      for (let i = children.length - 1; i >= 0; i--) {
        const child = children[i] as { id: NodeId; slot: string };
        stack.push({
          id: child.id,
          parentId: frame.id,
          level: frame.level + 1,
          pos: i + 1,
          size: children.length,
          slot: child.slot,
        });
      }
    }
  }
  return rows;
}
