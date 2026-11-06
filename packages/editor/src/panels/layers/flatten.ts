import type { BuilderDocument, NodeId, PageNode } from '@next-buildr/core';

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
  /** The parent has more than one slot with children, so the slot name tells rows apart. */
  readonly multiSlot?: boolean;
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
 * loop it. With `only` the tree is filtered: nodes outside the set are left out (the caller puts the
 * matches and their ancestors in it), and a node counts as having children only among those kept.
 */
export function flattenTree(
  doc: BuilderDocument,
  expanded: ReadonlySet<NodeId>,
  only?: ReadonlySet<NodeId>,
): LayerRow[] {
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
    multi: boolean;
  };
  const stack: Frame[] = [
    { id: doc.root, parentId: null, level: 1, pos: 1, size: 1, slot: 'default', multi: false },
  ];
  while (stack.length > 0) {
    const frame = stack.pop() as Frame;
    if (seen.has(frame.id)) continue;
    seen.add(frame.id);
    const node = doc.nodes[frame.id];
    if (node === undefined) continue;
    const children = childrenWithSlots(doc, node).filter(
      (child) => only === undefined || only.has(child.id),
    );
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
      multiSlot: frame.multi,
    });
    if (open) {
      const multi = new Set(children.map((child) => child.slot)).size > 1;
      for (let i = children.length - 1; i >= 0; i--) {
        const child = children[i] as { id: NodeId; slot: string };
        stack.push({
          id: child.id,
          parentId: frame.id,
          level: frame.level + 1,
          pos: i + 1,
          size: children.length,
          slot: child.slot,
          multi,
        });
      }
    }
  }
  return rows;
}

/**
 * The nodes a filter keeps: those `matches` accepts plus every ancestor of one (`only`), and the
 * ancestors alone (`open`), which the filtered tree shows expanded so each match is in view.
 * Walks from the root without recursion and visits a node once.
 */
export function filterTree(
  doc: BuilderDocument,
  matches: (node: PageNode) => boolean,
): { readonly only: ReadonlySet<NodeId>; readonly open: ReadonlySet<NodeId> } {
  const only = new Set<NodeId>();
  const open = new Set<NodeId>();
  const seen = new Set<NodeId>();
  const stack: { id: NodeId; path: readonly NodeId[] }[] = [{ id: doc.root, path: [] }];
  while (stack.length > 0) {
    const { id, path } = stack.pop() as { id: NodeId; path: readonly NodeId[] };
    if (seen.has(id)) continue;
    seen.add(id);
    const node = doc.nodes[id];
    if (node === undefined) continue;
    if (matches(node)) {
      only.add(id);
      for (const ancestor of path) {
        only.add(ancestor);
        open.add(ancestor);
      }
    }
    const next = [...path, id];
    for (const child of childrenWithSlots(doc, node)) stack.push({ id: child.id, path: next });
  }
  return { only, open };
}

/** Every node that has children: what "Expand all" opens. */
export function nodesWithChildren(doc: BuilderDocument): ReadonlySet<NodeId> {
  const ids = new Set<NodeId>();
  for (const [id, node] of Object.entries(doc.nodes)) {
    if (childrenWithSlots(doc, node).length > 0) ids.add(id);
  }
  return ids;
}
