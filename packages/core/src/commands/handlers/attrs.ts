import { z } from 'zod';
import { parsePath } from '../../data/path.ts';
import type { NodeId, PageNode } from '../../document/types.ts';
import { compileExpression, compileTemplate } from '../../expressions/compile.ts';
import { err, ok, type Result } from '../../result/result.ts';
import { canEdit } from '../../rules/can-edit.ts';
import { nearestLock } from '../../rules/locks.ts';
import { reason } from '../../rules/reasons.ts';
import { valueSchema } from '../../values/schema.ts';
import type { Value } from '../../values/types.ts';
import { type CommandError, commandError, fromReason } from '../errors.ts';
import type { Command, CommandHandler, HandlerEnv, UnlockRequest } from '../types.ts';

export const MAX_NAME_LENGTH = 80;
const ANCHOR = /^[a-z][a-z0-9-]{0,63}$/;
const REGION = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

type Lock = NonNullable<PageNode['lock']>;

export type SetAttrPayload =
  | { readonly id: NodeId; readonly key: 'name'; readonly value: string | null }
  | { readonly id: NodeId; readonly key: 'anchor'; readonly value: string | null }
  | { readonly id: NodeId; readonly key: 'region'; readonly value: string | null }
  | { readonly id: NodeId; readonly key: 'lock'; readonly value: Lock | null }
  | { readonly id: NodeId; readonly key: 'visibleIf'; readonly value: Value | null };

export type SetAttrCommand = Command<'node.setAttr', SetAttrPayload>;

const setAttrSchema = z.strictObject({
  id: z.string().min(1).max(64),
  key: z.enum(['name', 'anchor', 'lock', 'region', 'visibleIf']),
  value: z.unknown(),
});

const lockSchema = z.strictObject({
  structure: z.literal(true).optional(),
  content: z.literal(true).optional(),
  style: z.literal(true).optional(),
});

const invalid = (message: string): CommandError => commandError('command.invalid-value', message);

const ASPECTS = ['structure', 'content', 'style'] as const;

/** What `value` asks the host to permit: the lock aspects it switches off. */
const removedAspects = (
  current: Lock | undefined,
  next: Lock | undefined,
): UnlockRequest['aspects'] =>
  ASPECTS.filter((aspect) => current?.[aspect] === true && next?.[aspect] !== true);

function requireUnlock(
  env: HandlerEnv,
  nodeId: NodeId,
  aspects: UnlockRequest['aspects'],
): Result<void, CommandError> {
  if (aspects.length === 0) return ok(undefined);
  if (env.canUnlock?.({ nodeId, aspects }) === true) return ok(undefined);
  return err(
    commandError(
      'command.unlock-not-permitted',
      'You do not have permission to unlock this content.',
    ),
  );
}

/** The `visibleIf` value must be dynamic (a binding or an expression) and well-formed. */
function checkVisibleIf(raw: unknown): Result<Value, CommandError> {
  const parsed = valueSchema(z.boolean()).safeParse(raw);
  if (!parsed.success) return err(invalid('visibleIf must be a binding or an expression'));
  const value = parsed.data;
  if (value.kind === 'static') {
    return err(invalid('visibleIf must be a binding or an expression, not a fixed value'));
  }
  if (value.kind === 'binding') {
    const path = parsePath(value.path);
    return path.ok ? ok(value) : err(invalid(path.error.message));
  }
  if (value.l10n !== undefined) return err(invalid('visibleIf cannot be translated'));
  const compiled =
    value.mode === 'template' ? compileTemplate(value.expr) : compileExpression(value.expr);
  return compiled.ok ? ok(value) : err(invalid(compiled.error.message));
}

/** Validates the value for `key` and returns it normalized (`null` = remove). */
function normalize(
  doc: Parameters<CommandHandler['validate']>[0],
  payload: { id: NodeId; key: string; value: unknown },
): Result<unknown, CommandError> {
  const { id, key, value } = payload;
  if (key === 'name') {
    if (value === null) return ok(null);
    if (typeof value !== 'string') return err(invalid('name must be text'));
    if (value.length > MAX_NAME_LENGTH)
      return err(invalid(`name is at most ${MAX_NAME_LENGTH} characters`));
    return ok(value === '' ? null : value);
  }

  if (key === 'anchor') {
    if (value === null) return ok(null);
    if (typeof value !== 'string' || !ANCHOR.test(value)) {
      return err(
        invalid(
          'anchor must start with a lowercase letter and use lowercase letters, digits and dashes (up to 64)',
        ),
      );
    }
    for (const [otherId, other] of Object.entries(doc.nodes)) {
      if (otherId !== id && other.anchor === value) {
        return err(
          commandError(
            'command.duplicate-anchor',
            `The anchor "${value}" is already used by another node.`,
          ),
        );
      }
    }
    return ok(value);
  }

  if (key === 'region') {
    if (value === null) return ok(null);
    if (typeof value !== 'string' || !REGION.test(value)) {
      return err(
        invalid('region must be a name of letters, digits, dashes and underscores (up to 64)'),
      );
    }
    return ok(value);
  }

  if (key === 'lock') {
    if (value === null) return ok(null);
    const parsed = lockSchema.safeParse(value);
    if (!parsed.success) return err(invalid('lock is { structure?, content?, style? }, each true'));
    return ok(Object.keys(parsed.data).length === 0 ? null : parsed.data);
  }

  // visibleIf
  if (value === null) return ok(null);
  return checkVisibleIf(value);
}

/**
 * `node.setAttr` — sets or removes (`value: null`) a node attribute: `name` (layers-panel label,
 * up to 80 characters), `anchor` (an HTML id: `[a-z][a-z0-9-]{0,63}`, unique in the document),
 * `lock` (`{ structure?, content?, style? }`), `region` (an editable region inside a locked
 * subtree) and `visibleIf` (a binding or expression). Errors carry codes (`command.invalid-value`,
 * `command.duplicate-anchor`, `command.unlock-not-permitted`, ...).
 *
 * Locks are a permission matter: switching a lock flag off, or changing a `region` inside a
 * structurally locked subtree, needs `env.canUnlock` to say yes — without it, unlocking is
 * refused. Adding a lock is always allowed. `anchor` and `visibleIf` respect content locks.
 */
export const setAttrHandler: CommandHandler<SetAttrCommand> = {
  type: 'node.setAttr',
  schema: setAttrSchema,
  mergeKey: (cmd) => `attr:${cmd.payload.id}:${cmd.payload.key}`,

  validate(doc, cmd, env) {
    const { id, key } = cmd.payload;
    const node = Object.hasOwn(doc.nodes, id) ? doc.nodes[id] : undefined;
    if (node === undefined) {
      return err(
        fromReason(reason('node-not-found', `Node "${id}" does not exist.`, { nodeId: id })),
      );
    }
    if (id === doc.root && key !== 'name') {
      return err(commandError('command.invalid-attr', `The document root has no "${key}".`));
    }

    if (key === 'anchor' || key === 'visibleIf') {
      const editable = canEdit(doc, env.index, id, 'content');
      if (!editable.ok) return err(fromReason(editable.error));
    }

    const value = normalize(doc, cmd.payload);
    if (!value.ok) return value;

    if (key === 'lock') {
      return requireUnlock(
        env,
        id,
        removedAspects(node.lock, (value.value ?? undefined) as Lock | undefined),
      );
    }
    if (key === 'region' && nearestLock(doc, env.index, id, 'structure') !== undefined) {
      // Moving or removing the marker changes what is editable inside a locked subtree.
      return requireUnlock(env, id, ['structure']);
    }
    return ok(undefined);
  },

  apply(draft, cmd, env) {
    const { id, key } = cmd.payload;
    const node = draft.nodes[id];
    if (node === undefined) return { affected: [] };
    const normalized = normalize(env.doc, cmd.payload);
    if (!normalized.ok) return { affected: [] };

    const record = node as unknown as Record<string, unknown>;
    const next = normalized.value;
    const current = record[key];
    if (next === null) {
      if (current === undefined) return { affected: [] };
      delete record[key];
    } else {
      if (JSON.stringify(current) === JSON.stringify(next)) return { affected: [] };
      record[key] = next;
    }
    return { affected: [id] };
  },
};
