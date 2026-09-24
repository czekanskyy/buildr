import { z } from 'zod';
import { createIndex } from '../../document/document-index.ts';
import { extractFragment, reId } from '../../document/fragment.ts';
import type { NodeId, PageNode } from '../../document/types.ts';
import { err, ok } from '../../result/result.ts';
import { canInsert } from '../../rules/can-insert.ts';
import { reason } from '../../rules/reasons.ts';
import { valueSchema } from '../../values/schema.ts';
import type { Value } from '../../values/types.ts';
import { commandError, fromReason } from '../errors.ts';
import type { Command, CommandHandler } from '../types.ts';
import { checkPropValue } from './props.ts';
import { placeholderIds, withSlot } from './shared.ts';

export interface WrapPayload {
  /** Contiguous siblings (same parent and slot) to put inside the wrapper. */
  readonly ids: readonly NodeId[];
  readonly wrapper: {
    readonly type: string;
    readonly props?: Readonly<Record<string, Value>> | undefined;
  };
}

export type WrapCommand = Command<'node.wrap', WrapPayload>;

const DEFAULT_SLOT = 'default';

const wrapSchema = z.strictObject({
  ids: z.array(z.string().min(1).max(64)).min(1).max(500),
  wrapper: z.strictObject({
    type: z.string().min(1).max(64),
    props: z.record(z.string().max(64), valueSchema(z.unknown())).optional(),
  }),
});

/**
 * `node.wrap` — puts contiguous siblings into a new wrapper node's `default` slot, in the place
 * they occupied (docs/commands.md). Checked as one placement: the wrapper must be insertable
 * where the siblings are (slot rules, `slot.max` counted after the siblings leave, content model,
 * locks), each sibling must be draggable and insertable into the wrapper, the siblings must
 * fit the wrapper's `default` slot, and the wrapper's props must be valid for its component.
 * Selects the wrapper.
 */
export const wrapHandler: CommandHandler<WrapCommand> = {
  type: 'node.wrap',
  schema: wrapSchema,

  validate(doc, cmd, env) {
    const ids = [...new Set(cmd.payload.ids)];
    for (const id of ids) {
      if (!Object.hasOwn(doc.nodes, id)) {
        return err(
          fromReason(reason('node-not-found', `Node "${id}" does not exist.`, { nodeId: id })),
        );
      }
      if (id === doc.root) {
        return err(
          commandError('command.cannot-wrap-root', 'The document root cannot be wrapped.'),
        );
      }
    }
    const parentId = env.index.parentOf[ids[0] ?? ''];
    const slot = env.index.slotOf[ids[0] ?? ''];
    if (parentId === undefined || slot === undefined) {
      return err(
        commandError('command.wrap-not-siblings', 'Only siblings can be wrapped together.'),
      );
    }
    const positions = ids.map((id) => {
      const same = env.index.parentOf[id] === parentId && env.index.slotOf[id] === slot;
      return same ? env.index.indexOf[id] : undefined;
    });
    if (positions.some((position) => position === undefined)) {
      return err(
        commandError('command.wrap-not-siblings', 'Only siblings can be wrapped together.'),
      );
    }
    const sorted = (positions as number[]).sort((a, b) => a - b);
    const first = sorted[0] as number;
    if (sorted.some((position, i) => position !== first + i)) {
      return err(
        commandError(
          'command.wrap-not-contiguous',
          'Only siblings that are next to each other can be wrapped.',
        ),
      );
    }

    const { type, props } = cmd.payload.wrapper;
    const wrapperMeta = env.registry.get(type);
    if (wrapperMeta === undefined) {
      return err(
        fromReason(
          reason('unknown-component-type', `"${type}" is not a registered component.`, { type }),
        ),
      );
    }
    const defaultSlot = wrapperMeta.slots?.[DEFAULT_SLOT];
    if (defaultSlot === undefined) {
      return err(
        fromReason(
          reason('slot-not-found', `${wrapperMeta.label} has no "default" slot.`, {
            parentType: type,
            slot: 'default',
          }),
        ),
      );
    }
    for (const [name, value] of Object.entries(props ?? {})) {
      const def = Object.hasOwn(wrapperMeta.props, name) ? wrapperMeta.props[name] : undefined;
      if (def === undefined) {
        return err(
          commandError('command.unknown-prop', `${wrapperMeta.label} has no "${name}" prop.`),
        );
      }
      const checked = checkPropValue(def, value);
      if (!checked.ok) return checked;
    }
    if (defaultSlot.max !== undefined && ids.length > defaultSlot.max) {
      return err(
        fromReason(
          reason(
            'slot-max-exceeded',
            `${wrapperMeta.label} accepts at most ${defaultSlot.max} item(s).`,
            {
              slot: 'default',
              max: defaultSlot.max,
            },
          ),
        ),
      );
    }

    for (const id of ids) {
      const meta = env.registry.get(doc.nodes[id]?.type ?? '');
      if (meta?.capabilities?.draggable === false) {
        return err(
          fromReason(
            reason('not-draggable', `${meta.label} cannot be moved.`, { type: meta.type }),
          ),
        );
      }
    }

    // The wrapper goes where the siblings were: check it against the document without them.
    const parent = doc.nodes[parentId] as PageNode;
    const siblings = parent.slots?.[slot] ?? [];
    const remaining = siblings.filter((id) => !ids.includes(id));
    const without = withSlot(doc, parentId, slot, remaining);
    const wrapperId = '__wrapper';
    const wrapperFragment = {
      format: 'buildr/fragment' as const,
      schemaVersion: 1 as const,
      components: { [type]: wrapperMeta.version },
      roots: [wrapperId],
      nodes: { [wrapperId]: { id: wrapperId, type } },
    };
    const placed = canInsert(
      without,
      createIndex(without),
      env.registry,
      { parentId, slot, at: first },
      wrapperFragment,
    );
    if (!placed.ok) return err(fromReason(placed.error));

    // ...and each sibling against the wrapper's own place in that document (one at a time; the
    // slot's `max` for all of them was checked above).
    const withWrapper: typeof doc = {
      ...without,
      nodes: {
        ...without.nodes,
        [wrapperId]: { id: wrapperId, type },
        [parentId]: {
          ...(without.nodes[parentId] as PageNode),
          slots: {
            ...parent.slots,
            [slot]: [...remaining.slice(0, first), wrapperId, ...remaining.slice(first)],
          },
        },
      },
    };
    const withWrapperIndex = createIndex(withWrapper);
    for (const id of ids) {
      const fragment = reId(extractFragment(doc, [id]), placeholderIds());
      const verdict = canInsert(
        withWrapper,
        withWrapperIndex,
        env.registry,
        { parentId: wrapperId, slot: 'default', at: 0 },
        fragment,
      );
      if (!verdict.ok) return err(fromReason(verdict.error));
    }
    return ok(undefined);
  },

  apply(draft, cmd, env) {
    const { type, props } = cmd.payload.wrapper;
    const ids = [...new Set(cmd.payload.ids)].sort(
      (a, b) => (env.index.indexOf[a] ?? 0) - (env.index.indexOf[b] ?? 0),
    );
    const parentId = env.index.parentOf[ids[0] ?? ''];
    const slot = env.index.slotOf[ids[0] ?? ''];
    if (parentId === undefined || slot === undefined) return { affected: [] };
    const children = draft.nodes[parentId]?.slots?.[slot];
    if (children === undefined) return { affected: [] };

    let wrapperId = env.generateId();
    while (Object.hasOwn(draft.nodes, wrapperId)) wrapperId = env.generateId();
    const wrapper: PageNode = {
      id: wrapperId,
      type,
      ...(props !== undefined && Object.keys(props).length > 0 ? { props } : {}),
      slots: { default: ids },
    };
    draft.nodes[wrapperId] = wrapper as never;
    const version = env.registry.get(type)?.version;
    if (draft.components[type] === undefined && version !== undefined) {
      draft.components[type] = version;
    }
    children.splice(env.index.indexOf[ids[0] as NodeId] ?? 0, ids.length, wrapperId);
    return { affected: [parentId, wrapperId], select: [wrapperId] };
  },
};
