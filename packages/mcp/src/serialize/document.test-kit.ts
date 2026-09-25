import { type BuilderDocument, fromTree, type PageNode, type TreeNode } from '@buildr/core';

/** A deterministic id generator: n0000001, n0000002, ... (10 characters, like real ids). */
export function sequentialIds(): () => string {
  let n = 0;
  return () => `n${String(++n).padStart(9, '0')}`;
}

/** A document whose root is `tree` (a `buildr/page`), with sequential node ids. */
export function documentFromTree(tree: TreeNode): BuilderDocument {
  const fragment = fromTree(tree, sequentialIds());
  const rootId = fragment.roots[0] as string;
  const rename = (id: string): string => (id === rootId ? 'root' : id);
  const nodes: Record<string, PageNode> = {};
  for (const node of Object.values(fragment.nodes)) {
    nodes[rename(node.id)] = {
      ...node,
      id: rename(node.id),
      ...(node.slots
        ? {
            slots: Object.fromEntries(
              Object.entries(node.slots).map(([name, ids]) => [name, ids.map(rename)]),
            ),
          }
        : {}),
    };
  }
  return { schemaVersion: 1, root: 'root', nodes, components: fragment.components };
}
