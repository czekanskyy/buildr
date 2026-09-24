import { z } from 'zod';
import { createIndex } from '../../document/document-index.ts';
import { extractFragment, reId } from '../../document/fragment.ts';
import type { NodeId, PageNode } from '../../document/types.ts';
import { err, ok } from '../../result/result.ts';
import { canInsert } from '../../rules/can-insert.ts';
import { isLocked } from '../../rules/locks.ts';
import { reason } from '../../rules/reasons.ts';
import { commandError, fromReason } from '../errors.ts';
import type { Command, CommandHandler } from '../types.ts';
import { placeholderIds, withSlot } from './shared.ts';

export interface UnwrapPayload {
  readonly id: NodeId;
}

export type UnwrapCommand = Command<'node.unwrap', UnwrapPayload>;

const DEFAULT_SLOT = 'default';

const unwrapSchema = z.strictObject({ id: z.string().min(1).max(64) });

/**
 * `node.unwrap` — removes a node and puts the children of its `default` slot in its place
 * (docs/commands.md). A node with children in any other slot is rejected, since they would be
 * lost (`command.unwrap-has-other-slots`). Checked as one placement: the node must be removable
 * and not structurally locked, and each child must be insertable at the node's position, with
 * `slot.max` / `slot.min` counted after the swap. Selects the children (the parent when there
 * are none).
 */
export const unwrapHandler: CommandHandler<UnwrapCommand> = {
  type: 'node.unwrap',
  schema: unwrapSchema,

  validate(doc, cmd, env) {
    const { id } = cmd.payload;
    const node = Object.hasOwn(doc.nodes, id) ? doc.nodes[id] : undefined;
    if (node === undefined) {
      return err(
        fromReason(reason('node-not-found', `Node "${id}" does not exist.`, { nodeId: id })),
      );
    }
    if (id === doc.root) {
      return err(
        commandError('command.cannot-unwrap-root', 'The document root cannot be unwrapped.'),
      );
    }
    const parentId = env.index.parentOf[id];
    const slot = env.index.slotOf[id];
    const at = env.index.indexOf[id];
    if (parentId === undefined || slot === undefined || at === undefined) {
      return err(commandError('command.not-in-document', 'This node is not part of the document.'));
    }

    const meta = env.registry.get(node.type);
    if (meta?.capabilities?.removable === false) {
      return err(
        fromReason(
          reason('not-removable', `${meta.label} cannot be removed.`, { type: node.type }),
        ),
      );
    }
    if (isLocked(doc, env.index, id, 'structure')) {
      return err(
        fromReason(reason('locked-structure', 'This node is structurally locked.', { nodeId: id })),
      );
    }

    for (const [name, children] of Object.entries(node.slots ?? {})) {
      if (name !== DEFAULT_SLOT && children.length > 0) {
        return err(
          commandError(
            'command.unwrap-has-other-slots',
            `Unwrapping would discard the content of the "${name}" slot.`,
          ),
        );
      }
    }
    const inner = node.slots?.[DEFAULT_SLOT] ?? [];

    const parent = doc.nodes[parentId] as PageNode;
    const siblings = parent.slots?.[slot] ?? [];
    const parentMeta = env.registry.get(parent.type);
    const slotDef = parentMeta?.slots?.[slot];
    const after = siblings.length - 1 + inner.length;
    if (slotDef?.max !== undefined && after > slotDef.max) {
      return err(
        fromReason(
          reason('slot-max-exceeded', `"${slot}" accepts at most ${slotDef.max} item(s).`, {
            slot,
            max: slotDef.max,
          }),
        ),
      );
    }
    if (slotDef?.min !== undefined && after < slotDef.min) {
      return err(
        fromReason(
          reason('slot-min-violation', `"${slot}" requires at least ${slotDef.min} item(s).`, {
            parentId,
            slot,
            min: slotDef.min,
          }),
        ),
      );
    }

    // The node leaves its place; each child is then placed where it stood.
    const without = withSlot(
      doc,
      parentId,
      slot,
      siblings.filter((sibling) => sibling !== id),
    );
    const withoutIndex = createIndex(without);
    for (const [i, childId] of inner.entries()) {
      const fragment = reId(extractFragment(doc, [childId]), placeholderIds());
      const verdict = canInsert(
        without,
        withoutIndex,
        env.registry,
        { parentId, slot, at: at + i },
        fragment,
      );
      if (!verdict.ok) return err(fromReason(verdict.error));
    }
    return ok(undefined);
  },

  apply(draft, cmd, env) {
    const { id } = cmd.payload;
    const parentId = env.index.parentOf[id];
    const slot = env.index.slotOf[id];
    const children =
      parentId !== undefined && slot !== undefined
        ? draft.nodes[parentId]?.slots?.[slot]
        : undefined;
    if (parentId === undefined || children === undefined) return { affected: [] };
    const inner = env.doc.nodes[id]?.slots?.[DEFAULT_SLOT] ?? [];

    children.splice(children.indexOf(id), 1, ...inner);
    delete draft.nodes[id];
    return { affected: [parentId], select: inner.length > 0 ? [...inner] : [parentId] };
  },
};
