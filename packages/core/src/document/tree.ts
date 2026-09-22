import { generateId, type IdGenerator } from '../ids/index.ts';
import type { BuilderFragment } from './fragment.ts';
import type { BuilderDocument, ComponentType, NodeId, PageNode, SlotName } from './types.ts';

/**
 * The nested authoring format for templates, tests, and seeds — never persisted as-is (see
 * docs/document-model.md#fragment-and-authoring-formats). `children` is sugar for `slots.default`;
 * unlike `PageNode`, it carries no `id` (minted by `fromTree`) and no `visibleIf`/`source`/`ext`
 * (provenance and runtime-only fields that don't belong in hand-authored trees).
 */
export interface TreeNode {
  readonly type: ComponentType;
  readonly props?: PageNode['props'];
  readonly styles?: PageNode['styles'];
  readonly children?: readonly TreeNode[];
  readonly slots?: Readonly<Record<SlotName, readonly TreeNode[]>>;
  readonly name?: PageNode['name'];
  readonly anchor?: PageNode['anchor'];
  readonly lock?: PageNode['lock'];
  readonly region?: PageNode['region'];
}

/**
 * Builds a `BuilderFragment` from a nested `TreeNode`, minting a fresh ID (via `idGen`) for every
 * node and registering each component type encountered in `components` at version 1 (see
 * docs/document-model.md#fragment-and-authoring-formats). The fragment has a single root — use
 * `reId` afterward to duplicate it without ID collisions.
 */
export function fromTree(tree: TreeNode, idGen: IdGenerator = generateId): BuilderFragment {
  const nodes: Record<NodeId, PageNode> = {};
  const components: Record<ComponentType, number> = {};

  function build(treeNode: TreeNode): NodeId {
    const id = idGen();
    if (!(treeNode.type in components)) components[treeNode.type] = 1;

    const slotsSpec =
      treeNode.slots ?? (treeNode.children ? { default: treeNode.children } : undefined);
    const slots: Record<SlotName, NodeId[]> | undefined = slotsSpec
      ? Object.fromEntries(
          Object.entries(slotsSpec).map(([slotName, children]) => [slotName, children.map(build)]),
        )
      : undefined;

    nodes[id] = {
      id,
      type: treeNode.type,
      ...(treeNode.props !== undefined ? { props: treeNode.props } : {}),
      ...(slots !== undefined ? { slots } : {}),
      ...(treeNode.styles !== undefined ? { styles: treeNode.styles } : {}),
      ...(treeNode.name !== undefined ? { name: treeNode.name } : {}),
      ...(treeNode.anchor !== undefined ? { anchor: treeNode.anchor } : {}),
      ...(treeNode.lock !== undefined ? { lock: treeNode.lock } : {}),
      ...(treeNode.region !== undefined ? { region: treeNode.region } : {}),
    };
    return id;
  }

  const rootId = build(tree);

  return { format: 'buildr/fragment', schemaVersion: 1, components, roots: [rootId], nodes };
}

function nodeToTree(doc: BuilderDocument, node: PageNode): TreeNode {
  const slotsSpec = node.slots;
  const slots: Record<SlotName, TreeNode[]> | undefined = slotsSpec
    ? Object.fromEntries(
        Object.entries(slotsSpec).map(([slotName, children]) => [
          slotName,
          children
            .map((childId) => doc.nodes[childId])
            .filter((child): child is PageNode => child !== undefined)
            .map((child) => nodeToTree(doc, child)),
        ]),
      )
    : undefined;

  return {
    type: node.type,
    ...(node.props !== undefined ? { props: node.props } : {}),
    ...(node.styles !== undefined ? { styles: node.styles } : {}),
    ...(slots !== undefined ? { slots } : {}),
    ...(node.name !== undefined ? { name: node.name } : {}),
    ...(node.anchor !== undefined ? { anchor: node.anchor } : {}),
    ...(node.lock !== undefined ? { lock: node.lock } : {}),
    ...(node.region !== undefined ? { region: node.region } : {}),
  };
}

/**
 * Converts the subtree rooted at `nodeId` (inclusive) into the nested `TreeNode` authoring
 * format, dropping `id` and the fields `TreeNode` doesn't carry (`visibleIf`, `source`, `ext`) —
 * see docs/document-model.md#fragment-and-authoring-formats. A slot child ID missing from `doc`
 * is skipped, matching `walk`'s tolerance of a dangling reference. `nodeId` itself must resolve —
 * a caller invoking this with an ID that isn't in `doc` is a programmer error, not bad data.
 */
export function toTree(doc: BuilderDocument, nodeId: NodeId): TreeNode {
  const node = doc.nodes[nodeId];
  if (!node) throw new Error(`toTree: no node with id "${nodeId}" in the document`);
  return nodeToTree(doc, node);
}
