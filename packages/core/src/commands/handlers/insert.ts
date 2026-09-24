import { z } from 'zod';
import { type BuilderFragment, fragmentSchema, reId } from '../../document/fragment.ts';
import { DEFAULT_DOCUMENT_LIMITS } from '../../document/limits.ts';
import type { BuilderDocument, NodeId } from '../../document/types.ts';
import type { RegistryMeta } from '../../registry/registry.ts';
import { err, ok, type Result } from '../../result/result.ts';
import { canInsert } from '../../rules/can-insert.ts';
import { reason } from '../../rules/reasons.ts';
import { type CommandError, commandError, fromReason } from '../errors.ts';
import type { Command, CommandHandler } from '../types.ts';

export interface InsertPayload {
  readonly parentId: NodeId;
  readonly slot: string;
  /** Position within the slot; `0..children.length`. */
  readonly index: number;
  /** A component, a template or pasted content — always a fragment. */
  readonly fragment: BuilderFragment;
}

export type InsertCommand = Command<'node.insert', InsertPayload>;

const insertSchema = z.strictObject({
  parentId: z.string().min(1).max(64),
  slot: z.string().min(1).max(64),
  index: z.number().int().min(0),
  fragment: fragmentSchema,
});

const invalidFragment = (message: string): CommandError =>
  commandError('command.invalid-fragment', message);

/**
 * Whether the fragment is a well-formed forest — every child exists, every node is reachable from
 * a root exactly once (so no cycle and no shared child) — and returns its height (roots are 1).
 */
function checkFragmentStructure(fragment: BuilderFragment): Result<number, CommandError> {
  const seen = new Set<NodeId>();
  let height = 0;
  const stack: { id: NodeId; depth: number }[] = fragment.roots.map((id) => ({ id, depth: 1 }));
  while (stack.length > 0) {
    const frame = stack.pop();
    if (frame === undefined) break;
    const node = Object.hasOwn(fragment.nodes, frame.id) ? fragment.nodes[frame.id] : undefined;
    if (node === undefined) return err(invalidFragment(`the fragment has no node "${frame.id}"`));
    if (node.id !== frame.id) return err(invalidFragment(`node "${frame.id}" has a different id`));
    if (seen.has(frame.id)) {
      return err(invalidFragment(`node "${frame.id}" appears more than once in the fragment`));
    }
    seen.add(frame.id);
    height = Math.max(height, frame.depth);
    for (const children of Object.values(node.slots ?? {})) {
      for (const child of children) stack.push({ id: child, depth: frame.depth + 1 });
    }
  }
  if (seen.size !== Object.keys(fragment.nodes).length) {
    return err(invalidFragment('the fragment has nodes that are not reachable from its roots'));
  }
  return ok(height);
}

function checkTypes(
  doc: BuilderDocument,
  registry: RegistryMeta,
  fragment: BuilderFragment,
): Result<void, CommandError> {
  for (const node of Object.values(fragment.nodes)) {
    const meta = registry.get(node.type);
    if (meta === undefined) {
      return err(
        fromReason(
          reason('unknown-component-type', `"${node.type}" is not a registered component.`, {
            type: node.type,
          }),
        ),
      );
    }
    for (const slot of Object.keys(node.slots ?? {})) {
      if (meta.slots?.[slot] === undefined) {
        return err(
          fromReason(
            reason('slot-not-found', `${meta.label} has no "${slot}" slot.`, {
              parentType: node.type,
              slot,
            }),
          ),
        );
      }
    }
    // The fragment's props were written against its own component version; mixing two versions
    // of one component in a document would corrupt its props.
    const fragmentVersion = fragment.components[node.type];
    if (fragmentVersion === undefined) {
      return err(invalidFragment(`the fragment does not declare a version for "${node.type}"`));
    }
    const docVersion = doc.components[node.type];
    if (docVersion !== undefined && docVersion !== fragmentVersion) {
      return err(
        commandError(
          'command.component-version-mismatch',
          `"${node.type}" is version ${fragmentVersion} in the fragment but ${docVersion} in the document.`,
        ),
      );
    }
  }
  return ok(undefined);
}

/** An id generator that never returns an id already in `doc` or already handed out. */
function freshIds(nodes: object, generate: () => string): () => string {
  const used = new Set<string>();
  return () => {
    for (let attempt = 0; attempt < 1000; attempt++) {
      const id = generate();
      if (!Object.hasOwn(nodes, id) && !used.has(id)) {
        used.add(id);
        return id;
      }
    }
    throw new Error('node.insert: the id generator kept returning ids already in use');
  };
}

const collides = (nodes: object, fragment: BuilderFragment): boolean =>
  Object.keys(fragment.nodes).some((id) => Object.hasOwn(nodes, id));

/**
 * `node.insert` — puts a fragment's roots into `parentId`'s `slot` at `index`
 * (docs/commands.md). The fragment is checked as untrusted input: its shape, that it is a proper
 * forest, that every type/slot is registered, that its component versions agree with the
 * document's, and the document limits; then `canInsert` decides placement (slot rules,
 * `slot.max`, content model, locks) and its `Reason` message is passed through. A fragment
 * whose ids collide with the document (a second paste) gets fresh ones. Selects the inserted
 * roots.
 */
export const insertHandler: CommandHandler<InsertCommand> = {
  type: 'node.insert',
  schema: insertSchema,

  validate(doc, cmd, env) {
    const { parentId, slot, index, fragment } = cmd.payload;
    const parent = Object.hasOwn(doc.nodes, parentId) ? doc.nodes[parentId] : undefined;
    if (parent === undefined) {
      return err(
        fromReason(
          reason('target-not-found', `Target parent "${parentId}" does not exist.`, { parentId }),
        ),
      );
    }

    const structure = checkFragmentStructure(fragment);
    if (!structure.ok) return structure;
    const types = checkTypes(doc, env.registry, fragment);
    if (!types.ok) return types;

    const limits = DEFAULT_DOCUMENT_LIMITS;
    const count = Object.keys(fragment.nodes).length;
    if (Object.keys(doc.nodes).length + count > limits.maxNodes) {
      return err(
        commandError('command.limit-exceeded', `A document has at most ${limits.maxNodes} nodes.`),
      );
    }
    const parentDepth = env.index.depthOf[parentId];
    if (parentDepth !== undefined && parentDepth + structure.value > limits.maxDepth) {
      return err(
        commandError(
          'command.limit-exceeded',
          `A document is at most ${limits.maxDepth} levels deep.`,
        ),
      );
    }
    const existing = parent.slots?.[slot]?.length ?? 0;
    if (existing + fragment.roots.length > limits.maxSlotChildren) {
      return err(
        commandError(
          'command.limit-exceeded',
          `A slot holds at most ${limits.maxSlotChildren} nodes.`,
        ),
      );
    }

    // A colliding fragment is re-id'd before the placement check, or `canInsert` would mistake a
    // second paste of the same nodes for a move into their own subtree. Placeholder ids are enough
    // here: `apply` mints the real ones.
    let counter = 0;
    const checked = collides(doc.nodes, fragment)
      ? reId(fragment, () => `__insert-${counter++}`)
      : fragment;
    const verdict = canInsert(doc, env.index, env.registry, { parentId, slot, at: index }, checked);
    return verdict.ok ? ok(undefined) : err(fromReason(verdict.error));
  },

  apply(draft, cmd, env) {
    const { parentId, slot, index } = cmd.payload;
    const fragment = collides(draft.nodes, cmd.payload.fragment)
      ? reId(cmd.payload.fragment, freshIds(draft.nodes, env.generateId))
      : cmd.payload.fragment;

    for (const [id, node] of Object.entries(fragment.nodes)) draft.nodes[id] = node as never;
    for (const [type, version] of Object.entries(fragment.components)) {
      if (draft.components[type] === undefined) draft.components[type] = version;
    }

    const parent = draft.nodes[parentId];
    if (parent === undefined) return { affected: [] };
    const slots = parent.slots ?? {};
    const children = slots[slot] ?? [];
    children.splice(index, 0, ...fragment.roots);
    slots[slot] = children;
    parent.slots = slots;

    return { affected: [parentId, ...Object.keys(fragment.nodes)], select: fragment.roots };
  },
};
