import { createIndex, traverseFrames } from './document-index.ts';
import type { BuilderDocument, NodeId, PageNode } from './types.ts';

/** Pre-order walk of the subtree rooted at `startId` (default the document root). */
export function* walk(
  doc: BuilderDocument,
  startId: NodeId = doc.root,
): Generator<PageNode, void, void> {
  for (const frame of traverseFrames(doc, startId)) yield frame.node;
}

/**
 * `id`'s ancestor chain, nearest parent first, ending at the root. Empty for the root itself or
 * an unreachable ID.
 */
export function ancestors(doc: BuilderDocument, id: NodeId): NodeId[] {
  const { parentOf } = createIndex(doc);
  const result: NodeId[] = [];
  const visited = new Set<NodeId>([id]);
  let current = parentOf[id];
  while (current !== undefined && !visited.has(current)) {
    result.push(current);
    visited.add(current);
    current = parentOf[current];
  }
  return result;
}

/** The root-to-`id` path, inclusive of both ends. Empty if `id` is unreachable from the root. */
export function pathTo(doc: BuilderDocument, id: NodeId): NodeId[] {
  if (!doc.nodes[id]) return [];
  return [...ancestors(doc, id)].reverse().concat(id);
}

/** All descendant IDs of `id` in pre-order, excluding `id` itself. */
export function descendants(doc: BuilderDocument, id: NodeId): NodeId[] {
  return subtreeIds(doc, id).slice(1);
}

/** `id` and all of its descendant IDs, in pre-order. */
export function subtreeIds(doc: BuilderDocument, id: NodeId): NodeId[] {
  return [...walk(doc, id)].map((node) => node.id);
}

/** Whether `ancestorId` is a strict ancestor of `id` (a node is never its own ancestor). */
export function isAncestor(doc: BuilderDocument, ancestorId: NodeId, id: NodeId): boolean {
  if (ancestorId === id) return false;
  return ancestors(doc, id).includes(ancestorId);
}
