import { z } from 'zod';
import { generateId, type IdGenerator } from '../ids/index.ts';
import { COMPONENT_TYPE_PATTERN, pageNodeSchema, RANDOM_NODE_ID_PATTERN } from './schema.ts';
import { subtreeIds } from './traverse.ts';
import type { BuilderDocument, ComponentType, NodeId, PageNode } from './types.ts';

/** Transport format: the clipboard, template insertion, the protocol's "insert" message. */
export interface BuilderFragment {
  readonly format: 'buildr/fragment';
  readonly schemaVersion: 1;
  readonly components: Readonly<Record<ComponentType, number>>;
  /** Top-level nodes of the fragment. */
  readonly roots: readonly NodeId[];
  readonly nodes: Readonly<Record<NodeId, PageNode>>;
}

// A fragment never contains the document root itself — every node (and every root) is an
// ordinary, randomly-minted ID.
const fragmentNodeIdSchema = z.string().regex(RANDOM_NODE_ID_PATTERN);

/**
 * Validates a fragment's shape — for an untrusted source (clipboard contents, a protocol "insert"
 * payload). Format only, like `documentSchema`: every `roots` entry must have a matching node.
 */
export const fragmentSchema = z
  .strictObject({
    format: z.literal('buildr/fragment'),
    schemaVersion: z.literal(1),
    components: z.record(z.string().regex(COMPONENT_TYPE_PATTERN), z.number().int().min(1)),
    roots: z.array(fragmentNodeIdSchema).min(1),
    nodes: z.record(fragmentNodeIdSchema, pageNodeSchema),
  })
  .superRefine((fragment, ctx) => {
    fragment.roots.forEach((rootId, index) => {
      if (!Object.hasOwn(fragment.nodes, rootId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['roots', index],
          message: `root "${rootId}" has no matching node in the fragment`,
          params: { code: 'fragment.missing-root-node' },
        });
      }
    });
  });

/**
 * Pulls the subtree rooted at each of `ids` out of `doc` into a standalone fragment — the
 * clipboard's "copy" (see docs/document-model.md#fragment-and-authoring-formats). Node objects
 * are reused as-is, still carrying `doc`'s node IDs; call `reId` before inserting the result so a
 * second paste doesn't collide with the first. An ID that isn't in `doc`, is the document root
 * (which can never be extracted), or repeats is skipped/deduplicated rather than rejected —
 * `ids` is assumed to come from the app's own selection, not untrusted input.
 */
export function extractFragment(doc: BuilderDocument, ids: readonly NodeId[]): BuilderFragment {
  const roots: NodeId[] = [];
  const seenRoots = new Set<NodeId>();
  const nodes: Record<NodeId, PageNode> = {};
  const components: Record<ComponentType, number> = {};

  for (const id of ids) {
    if (id === doc.root || seenRoots.has(id) || !doc.nodes[id]) continue;
    seenRoots.add(id);
    roots.push(id);

    for (const descendantId of subtreeIds(doc, id)) {
      const node = doc.nodes[descendantId];
      if (!node) continue;
      nodes[descendantId] = node;
      const version = doc.components[node.type];
      if (version !== undefined) components[node.type] = version;
    }
  }

  return { format: 'buildr/fragment', schemaVersion: 1, components, roots, nodes };
}

/**
 * Returns a copy of `fragment` with every node ID replaced by a freshly generated one (via
 * `idGen`), preserving tree structure — needed before inserting the same fragment more than once
 * so the copies don't collide (see docs/document-model.md#fragment-and-authoring-formats).
 */
export function reId(fragment: BuilderFragment, idGen: IdGenerator = generateId): BuilderFragment {
  const idMap = new Map<NodeId, NodeId>();
  for (const id of Object.keys(fragment.nodes)) idMap.set(id, idGen());

  function remap(id: NodeId): NodeId {
    const mapped = idMap.get(id);
    if (mapped === undefined) throw new Error(`reId: fragment has no node "${id}"`);
    return mapped;
  }

  const nodes: Record<NodeId, PageNode> = {};
  for (const [oldId, node] of Object.entries(fragment.nodes)) {
    const newId = remap(oldId);
    nodes[newId] = {
      ...node,
      id: newId,
      ...(node.slots !== undefined
        ? {
            slots: Object.fromEntries(
              Object.entries(node.slots).map(([slotName, children]) => [
                slotName,
                children.map(remap),
              ]),
            ),
          }
        : {}),
    };
  }

  return { ...fragment, roots: fragment.roots.map(remap), nodes };
}
