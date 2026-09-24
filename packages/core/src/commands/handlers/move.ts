import { z } from 'zod';
import type { NodeId } from '../../document/types.ts';
import { err, ok } from '../../result/result.ts';
import { canMove } from '../../rules/can-move.ts';
import { reason } from '../../rules/reasons.ts';
import { commandError, fromReason } from '../errors.ts';
import type { Command, CommandHandler } from '../types.ts';

export interface MovePayload {
  /** Siblings (same parent and slot) to move; they keep their relative order. */
  readonly ids: readonly NodeId[];
  readonly parentId: NodeId;
  readonly slot: string;
  /**
   * Where to drop, as a position in the destination slot *as it is now* (`0..children.length`,
   * before the move). When the nodes move within their own slot the handler corrects for them
   * being taken out first, so the gap the user pointed at is what counts.
   */
  readonly index: number;
}

export type MoveCommand = Command<'node.move', MovePayload>;

const moveSchema = z.strictObject({
  ids: z.array(z.string().min(1).max(64)).min(1).max(500),
  parentId: z.string().min(1).max(64),
  slot: z.string().min(1).max(64),
  index: z.number().int().min(0),
});

/**
 * `node.move` — relocates sibling nodes (with their subtrees) within a slot or to another
 * container (docs/commands.md). Every node must pass `canMove` (draggable, current location not
 * locked, destination slot/content-model/lock rules, no move into its own subtree) and together
 * they must fit the destination's `max`. Dropping a node where it already is changes nothing.
 * Ids across different parents or slots are rejected (`command.move-not-siblings`).
 */
export const moveHandler: CommandHandler<MoveCommand> = {
  type: 'node.move',
  schema: moveSchema,

  validate(doc, cmd, env) {
    const { parentId, slot, index } = cmd.payload;
    const ids = [...new Set(cmd.payload.ids)];

    for (const id of ids) {
      if (!Object.hasOwn(doc.nodes, id)) {
        return err(
          fromReason(reason('node-not-found', `Node "${id}" does not exist.`, { nodeId: id })),
        );
      }
    }
    const from = {
      parentId: env.index.parentOf[ids[0] ?? ''],
      slot: env.index.slotOf[ids[0] ?? ''],
    };
    for (const id of ids) {
      if (id === doc.root) {
        return err(
          fromReason(
            reason('cannot-move-root', 'The document root cannot be moved.', { nodeId: id }),
          ),
        );
      }
      if (env.index.parentOf[id] !== from.parentId || env.index.slotOf[id] !== from.slot) {
        return err(
          commandError(
            'command.move-not-siblings',
            'Only siblings in one slot can be moved together.',
          ),
        );
      }
    }

    for (const id of ids) {
      // The index is checked below, against the slot as it is before the move.
      const verdict = canMove(doc, env.index, env.registry, id, { parentId, slot });
      if (!verdict.ok) return err(fromReason(verdict.error));
    }

    const destination = doc.nodes[parentId];
    const children = destination?.slots?.[slot] ?? [];
    if (index > children.length) {
      return err(
        fromReason(
          reason(
            'invalid-index',
            `Index ${index} is out of range for "${slot}" (0-${children.length}).`,
            { at: index, slot },
          ),
        ),
      );
    }

    // canMove counts one moving node; several together must fit too.
    const max = destination ? env.registry.get(destination.type)?.slots?.[slot]?.max : undefined;
    const staying = children.filter((id) => !ids.includes(id)).length;
    if (max !== undefined && staying + ids.length > max) {
      return err(
        fromReason(
          reason('slot-max-exceeded', `"${slot}" accepts at most ${max} item(s).`, {
            slot,
            max,
          }),
        ),
      );
    }
    return ok(undefined);
  },

  apply(draft, cmd, env) {
    const { parentId, slot, index } = cmd.payload;
    const ids = [...new Set(cmd.payload.ids)];
    const sourceId = env.index.parentOf[ids[0] ?? ''];
    const sourceSlot = env.index.slotOf[ids[0] ?? ''];
    if (sourceId === undefined || sourceSlot === undefined) return { affected: [] };

    // In document order, so the moved nodes keep the order they had.
    const moving = [...ids].sort(
      (a, b) => (env.index.indexOf[a] ?? 0) - (env.index.indexOf[b] ?? 0),
    );
    const sameSlot = sourceId === parentId && sourceSlot === slot;

    const before = env.doc.nodes[parentId]?.slots?.[slot] ?? [];
    const target = sameSlot
      ? index - before.slice(0, index).filter((id) => moving.includes(id)).length
      : index;

    if (sameSlot) {
      const without = before.filter((id) => !moving.includes(id));
      const after = [...without.slice(0, target), ...moving, ...without.slice(target)];
      if (after.every((id, i) => id === before[i])) return { affected: [], select: moving };
    }

    const source = draft.nodes[sourceId];
    const sourceChildren = source?.slots?.[sourceSlot];
    if (source === undefined || sourceChildren === undefined) return { affected: [] };
    const remaining = sourceChildren.filter((id) => !moving.includes(id));
    sourceChildren.splice(0, sourceChildren.length, ...remaining);

    const destination = draft.nodes[parentId];
    if (destination === undefined) return { affected: [] };
    const slots = destination.slots ?? {};
    const children = slots[slot] ?? [];
    children.splice(target, 0, ...moving);
    slots[slot] = children;
    destination.slots = slots;

    return { affected: sameSlot ? [parentId] : [sourceId, parentId], select: moving };
  },
};
