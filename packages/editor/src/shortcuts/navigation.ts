import type { BuilderDocument, NodeId } from '@next-buildr/core';

/**
 * What Escape selects: the parent of the first selected node, or `null` when the selection should
 * be cleared instead (nothing selected, the node is at the top level, or it is not in the
 * document). The page root is never selected this way.
 */
export function parentSelection(
  doc: BuilderDocument,
  selectedIds: readonly NodeId[],
): NodeId | null {
  const [first] = selectedIds;
  if (first === undefined || first === doc.root) return null;
  for (const [id, node] of Object.entries(doc.nodes)) {
    if (id === doc.root) continue;
    if (Object.values(node.slots ?? {}).some((children) => children.includes(first))) return id;
  }
  return null;
}

/** How many nodes lie below `ids` (their own descendants, each counted once; `ids` excluded). */
export function descendantCount(doc: BuilderDocument, ids: readonly NodeId[]): number {
  const own = new Set(ids);
  const seen = new Set<NodeId>();
  const stack: NodeId[] = [...ids];
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined) continue;
    for (const children of Object.values(doc.nodes[id]?.slots ?? {})) {
      for (const child of children) {
        if (seen.has(child) || own.has(child) || !Object.hasOwn(doc.nodes, child)) continue;
        seen.add(child);
        stack.push(child);
      }
    }
  }
  return seen.size;
}

export const hasDescendants = (doc: BuilderDocument, ids: readonly NodeId[]): boolean =>
  descendantCount(doc, ids) > 0;

const OVERLAY_SELECTOR = [
  '[role="menu"][data-state="open"]',
  '[role="listbox"][data-state="open"]',
  '[role="dialog"][data-state="open"]',
  '[role="alertdialog"][data-state="open"]',
].join(', ');

/** Whether a menu, list, popover or dialog is open: a key then belongs to it (Escape closes it). */
export function overlayOpen(scope: ParentNode = document): boolean {
  return scope.querySelector(OVERLAY_SELECTOR) !== null;
}
