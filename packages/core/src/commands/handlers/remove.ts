import { z } from 'zod';
import type { DocumentIndex } from '../../document/document-index.ts';
import { subtreeIds } from '../../document/traverse.ts';
import type { NodeId } from '../../document/types.ts';
import { err, ok } from '../../result/result.ts';
import { canRemove } from '../../rules/can-remove.ts';
import { reason } from '../../rules/reasons.ts';
import { commandError, fromReason } from '../errors.ts';
import type { Command, CommandHandler } from '../types.ts';

export interface RemovePayload {
  /** Nodes to remove, each with its whole subtree. */
  readonly ids: readonly NodeId[];
}

export type RemoveCommand = Command<'node.remove', RemovePayload>;

const MAX_REMOVE_IDS = 5000;

const removeSchema = z.strictObject({
  ids: z.array(z.string().min(1).max(64)).min(1).max(MAX_REMOVE_IDS),
});

/**
 * The ids that are not inside another removed node's subtree, in document order — removing a
 * node takes its descendants with it, so listing both is not an error, just redundant.
 */
function topLevel(ids: readonly NodeId[], index: DocumentIndex): NodeId[] {
  const wanted = new Set(ids);
  const covered = (id: NodeId): boolean => {
    for (let p = index.parentOf[id]; p !== undefined; p = index.parentOf[p]) {
      if (wanted.has(p)) return true;
    }
    return false;
  };
  return [...wanted]
    .filter((id) => !covered(id))
    .sort((a, b) => index.order.indexOf(a) - index.order.indexOf(b));
}

/**
 * `node.remove` — removes nodes with their subtrees (docs/commands.md). Each top-level node must
 * pass `canRemove` (root, `removable`, structural locks, the slot's `min`); several siblings
 * removed at once are also checked together against the slot's `min`. Nothing is left orphaned
 * in `doc.nodes`. The selection moves to the neighbour that takes the first removed node's place
 * (the next sibling, else the previous one), else to the parent.
 */
export const removeHandler: CommandHandler<RemoveCommand> = {
  type: 'node.remove',
  schema: removeSchema,

  validate(doc, cmd, env) {
    for (const id of cmd.payload.ids) {
      if (!Object.hasOwn(doc.nodes, id)) {
        return err(
          fromReason(reason('node-not-found', `Node "${id}" does not exist.`, { nodeId: id })),
        );
      }
    }
    const roots = topLevel(cmd.payload.ids, env.index);

    const removedPerSlot = new Map<string, number>();
    for (const id of roots) {
      const verdict = canRemove(doc, env.index, env.registry, id);
      if (!verdict.ok) return err(fromReason(verdict.error));
      const parentId = env.index.parentOf[id];
      const slot = env.index.slotOf[id];
      if (parentId === undefined || slot === undefined) continue;
      const key = `${parentId}\u0000${slot}`;
      removedPerSlot.set(key, (removedPerSlot.get(key) ?? 0) + 1);
    }

    // `canRemove` checks one node at a time; several siblings can together drop a slot below `min`.
    for (const key of removedPerSlot.keys()) {
      const [parentId, slot] = key.split('\u0000') as [string, string];
      const parent = doc.nodes[parentId];
      const min = parent ? env.registry.get(parent.type)?.slots?.[slot]?.min : undefined;
      const remaining = (parent?.slots?.[slot]?.length ?? 0) - (removedPerSlot.get(key) ?? 0);
      if (min !== undefined && remaining < min) {
        return err(
          fromReason(
            reason('slot-min-violation', `"${slot}" requires at least ${min} item(s).`, {
              parentId,
              slot,
              min,
            }),
          ),
        );
      }
    }
    if (roots.length === 0)
      return err(commandError('command.invalid-payload', 'nothing to remove'));
    return ok(undefined);
  },

  apply(draft, cmd, env) {
    const base = env.doc;
    const index = env.index;
    const roots = topLevel(cmd.payload.ids, index);
    const removed = new Set(roots.flatMap((id) => subtreeIds(base, id)));

    // Where the selection goes, decided against the pre-removal layout.
    const first = roots[0];
    let select: NodeId[] = [];
    const affected = new Set<NodeId>();

    for (const id of roots) {
      const parentId = index.parentOf[id];
      const slot = index.slotOf[id];
      if (parentId === undefined || slot === undefined) continue;
      affected.add(parentId);
      const parent = draft.nodes[parentId];
      const children = parent?.slots?.[slot];
      if (children === undefined) continue;
      const at = children.indexOf(id);
      if (at !== -1) children.splice(at, 1);
    }

    if (first !== undefined) {
      const parentId = index.parentOf[first];
      const slot = index.slotOf[first];
      const siblings =
        parentId !== undefined && slot !== undefined
          ? draft.nodes[parentId]?.slots?.[slot]
          : undefined;
      if (parentId !== undefined && siblings !== undefined) {
        const before =
          base.nodes[parentId]?.slots?.[slot ?? '']?.slice(0, index.indexOf[first] ?? 0) ?? [];
        const position = before.filter((id) => !removed.has(id)).length;
        const neighbour = siblings[position] ?? siblings[position - 1];
        select = [neighbour ?? parentId];
      }
    }

    for (const id of removed) delete draft.nodes[id];
    return { affected: [...affected], select };
  },
};
