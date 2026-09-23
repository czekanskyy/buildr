import type { BuilderFragment } from '../document/fragment.ts';
import { fromTree, type TreeNode } from '../document/tree.ts';
import { generateId, type IdGenerator } from '../ids/index.ts';
import type { TemplateDefinition } from '../registry/registry.ts';

function resolveTree(def: TemplateDefinition, variant: string | undefined): TreeNode {
  if (variant === undefined) return def.tree;
  const variantTree = def.variants?.[variant];
  if (!variantTree) {
    throw new Error(`instantiateTemplate: template "${def.id}" has no variant "${variant}"`);
  }
  return variantTree;
}

/**
 * Builds a fresh, detached instance of `def` (or one of its `variants`) as a `BuilderFragment`
 * ready for `canInsert`/insertion (docs/templates.md, ADR-020) — every node gets a newly minted ID
 * (via `idGen`, so calling this twice never collides), and the fragment root additionally gets a
 * `source: { template: def.id, version: def.version }` marker plus, when `def.lock ===
 * 'structure'`, a `lock.structure: true` flag layered on top of whatever `lock` the root's own
 * `TreeNode` already declared. From the moment it's inserted the result is an ordinary, fully
 * independent part of the document — there is no link back to `def` (ADR-020's "detached
 * instances" decision; docs/templates.md#what-templates-are-not).
 */
export function instantiateTemplate(
  def: TemplateDefinition,
  variant?: string,
  idGen: IdGenerator = generateId,
): BuilderFragment {
  const tree = resolveTree(def, variant);
  const fragment = fromTree(tree, idGen);

  const rootId = fragment.roots[0];
  const rootNode = rootId !== undefined ? fragment.nodes[rootId] : undefined;
  if (rootId === undefined || !rootNode) {
    throw new Error(`instantiateTemplate: template "${def.id}" produced a fragment with no root`);
  }

  return {
    ...fragment,
    nodes: {
      ...fragment.nodes,
      [rootId]: {
        ...rootNode,
        source: { template: def.id, version: def.version },
        ...(def.lock === 'structure'
          ? { lock: { ...rootNode.lock, structure: true as const } }
          : {}),
      },
    },
  };
}
