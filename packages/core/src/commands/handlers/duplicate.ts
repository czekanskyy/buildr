import { z } from 'zod';
import { extractFragment, reId } from '../../document/fragment.ts';
import { DEFAULT_DOCUMENT_LIMITS } from '../../document/limits.ts';
import type { NodeId, PageNode } from '../../document/types.ts';
import { err, ok } from '../../result/result.ts';
import { canInsert } from '../../rules/can-insert.ts';
import { reason } from '../../rules/reasons.ts';
import { commandError, fromReason } from '../errors.ts';
import type { Command, CommandHandler } from '../types.ts';
import { placeholderIds, topLevelIds } from './shared.ts';

export interface DuplicatePayload {
  /** Nodes to copy, each with its subtree; every copy lands right after its original. */
  readonly ids: readonly NodeId[];
}

export type DuplicateCommand = Command<'node.duplicate', DuplicatePayload>;

const duplicateSchema = z.strictObject({
  ids: z.array(z.string().min(1).max(64)).min(1).max(500),
});

/**
 * `node.duplicate` — copies nodes with their subtrees, with fresh ids, right after each
 * original (docs/commands.md). Every copy must pass `canInsert` at its position (slot rules,
 * `slot.max` — also for several copies into one slot —, content model, locks) and the document
 * limits must hold. Copies drop `anchor`, which must stay unique in a document. Selects the copies.
 */
export const duplicateHandler: CommandHandler<DuplicateCommand> = {
  type: 'node.duplicate',
  schema: duplicateSchema,

  validate(doc, cmd, env) {
    for (const id of cmd.payload.ids) {
      if (!Object.hasOwn(doc.nodes, id)) {
        return err(
          fromReason(reason('node-not-found', `Node "${id}" does not exist.`, { nodeId: id })),
        );
      }
      if (id === doc.root) {
        return err(
          commandError('command.cannot-duplicate-root', 'The document root cannot be duplicated.'),
        );
      }
    }
    const roots = topLevelIds(cmd.payload.ids, env.index);

    let added = 0;
    const perSlot = new Map<string, number>();
    for (const id of roots) {
      const parentId = env.index.parentOf[id];
      const slot = env.index.slotOf[id];
      const at = env.index.indexOf[id];
      if (parentId === undefined || slot === undefined || at === undefined) continue;
      const fragment = reId(extractFragment(doc, [id]), placeholderIds());
      const verdict = canInsert(
        doc,
        env.index,
        env.registry,
        { parentId, slot, at: at + 1 },
        fragment,
      );
      if (!verdict.ok) return err(fromReason(verdict.error));
      added += Object.keys(fragment.nodes).length;
      const key = `${parentId}\u0000${slot}`;
      perSlot.set(key, (perSlot.get(key) ?? 0) + 1);
    }

    // `canInsert` sees one copy at a time; several copies into one slot must fit together.
    for (const [key, copies] of perSlot) {
      const [parentId, slot] = key.split('\u0000') as [string, string];
      const parent = doc.nodes[parentId];
      const max = parent ? env.registry.get(parent.type)?.slots?.[slot]?.max : undefined;
      const existing = parent?.slots?.[slot]?.length ?? 0;
      if (max !== undefined && existing + copies > max) {
        return err(
          fromReason(
            reason('slot-max-exceeded', `"${slot}" accepts at most ${max} item(s).`, { slot, max }),
          ),
        );
      }
      if (existing + copies > DEFAULT_DOCUMENT_LIMITS.maxSlotChildren) {
        return err(
          commandError(
            'command.limit-exceeded',
            `A slot holds at most ${DEFAULT_DOCUMENT_LIMITS.maxSlotChildren} nodes.`,
          ),
        );
      }
    }
    if (Object.keys(doc.nodes).length + added > DEFAULT_DOCUMENT_LIMITS.maxNodes) {
      return err(
        commandError(
          'command.limit-exceeded',
          `A document has at most ${DEFAULT_DOCUMENT_LIMITS.maxNodes} nodes.`,
        ),
      );
    }
    return ok(undefined);
  },

  apply(draft, cmd, env) {
    const roots = topLevelIds(cmd.payload.ids, env.index);
    const affected = new Set<NodeId>();
    const select: NodeId[] = [];

    for (const id of roots) {
      const parentId = env.index.parentOf[id];
      const slot = env.index.slotOf[id];
      if (parentId === undefined || slot === undefined) continue;
      const used = new Set<string>();
      const fragment = reId(extractFragment(env.doc, [id]), () => {
        for (let attempt = 0; attempt < 1000; attempt++) {
          const fresh = env.generateId();
          if (!Object.hasOwn(draft.nodes, fresh) && !used.has(fresh)) {
            used.add(fresh);
            return fresh;
          }
        }
        throw new Error('node.duplicate: the id generator kept returning ids already in use');
      });

      for (const [newId, node] of Object.entries(fragment.nodes)) {
        const { anchor: _anchor, ...withoutAnchor } = node;
        draft.nodes[newId] = withoutAnchor as PageNode as never;
      }
      const children = draft.nodes[parentId]?.slots?.[slot];
      if (children === undefined) continue;
      // Positions shift as earlier copies go in, so look the original up each time.
      const copyId = fragment.roots[0] as NodeId;
      children.splice(children.indexOf(id) + 1, 0, copyId);
      select.push(copyId);
      affected.add(parentId);
      for (const newId of Object.keys(fragment.nodes)) affected.add(newId);
    }

    return { affected: [...affected], select };
  },
};
