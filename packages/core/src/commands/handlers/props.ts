import { z } from 'zod';
import { parsePath } from '../../data/path.ts';
import type { NodeId, PageNode } from '../../document/types.ts';
import { compileExpression, compileTemplate } from '../../expressions/compile.ts';
import { err, ok, type Result } from '../../result/result.ts';
import { canEdit } from '../../rules/can-edit.ts';
import { reason } from '../../rules/reasons.ts';
import type { PropDef } from '../../schema/kinds/index.ts';
import { validatePropValue } from '../../schema/validate.ts';
import { valueSchema } from '../../values/schema.ts';
import type { Value } from '../../values/types.ts';
import { type CommandError, commandError, fromReason } from '../errors.ts';
import type { Command, CommandHandler, HandlerEnv } from '../types.ts';

export interface SetPropPayload {
  readonly id: NodeId;
  readonly prop: string;
  readonly value: Value;
  /**
   * Omitted: write the default-language value (the whole `Value`). Set: write that language's
   * translation into `l10n[locale]` — `value` must then be a `static` value (its `value` is the
   * translation) or a template-mode `expression` (its `expr` is the translation) of the same
   * kind as the prop's current value.
   */
  readonly locale?: string | undefined;
}

export interface UnsetPropPayload {
  readonly id: NodeId;
  readonly prop: string;
  /** Set: remove only that language's translation. Omitted: remove the prop (back to its default). */
  readonly locale?: string | undefined;
}

export type SetPropCommand = Command<'node.setProp', SetPropPayload>;
export type UnsetPropCommand = Command<'node.unsetProp', UnsetPropPayload>;

const nodeId = z.string().min(1).max(64);
const propName = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/);
const locale = z.string().min(1).max(35);

const setPropSchema = z.strictObject({
  id: nodeId,
  prop: propName,
  value: valueSchema(z.unknown()),
  locale: locale.optional(),
});

const unsetPropSchema = z.strictObject({ id: nodeId, prop: propName, locale: locale.optional() });

type Target = { readonly node: PageNode; readonly def: PropDef };

/** The node, its component's definition of `prop`, and the content lock — shared by both commands. */
function target(
  doc: Parameters<CommandHandler['validate']>[0],
  env: HandlerEnv,
  id: NodeId,
  prop: string,
): Result<Target, CommandError> {
  const node = Object.hasOwn(doc.nodes, id) ? doc.nodes[id] : undefined;
  if (node === undefined) {
    return err(
      fromReason(reason('node-not-found', `Node "${id}" does not exist.`, { nodeId: id })),
    );
  }
  const meta = env.registry.get(node.type);
  if (meta === undefined) {
    return err(
      fromReason(
        reason('unknown-component-type', `"${node.type}" is not a registered component.`, {
          type: node.type,
        }),
      ),
    );
  }
  const def = Object.hasOwn(meta.props, prop) ? meta.props[prop] : undefined;
  if (def === undefined) {
    return err(commandError('command.unknown-prop', `${meta.label} has no "${prop}" prop.`));
  }
  const editable = canEdit(doc, env.index, id, 'content');
  if (!editable.ok) return err(fromReason(editable.error));
  return ok({ node, def });
}

const invalidValue = (message: string): CommandError =>
  commandError('command.invalid-value', message);

function checkStatic(def: PropDef, value: unknown, what: string): Result<void, CommandError> {
  const checked = validatePropValue(def, value);
  return checked.ok ? ok(undefined) : err(invalidValue(`${what}: ${checked.error.message}`));
}

/** The prop's own kind validator for a static value, `bindable` and syntax for the dynamic kinds. */
/** The prop's own validation of a whole `Value` (shared with `node.wrap`'s wrapper props). */
export function checkPropValue(def: PropDef, value: Value): Result<void, CommandError> {
  if (value.kind === 'static') {
    const main = checkStatic(def, value.value, 'the value');
    if (!main.ok) return main;
    if (value.l10n !== undefined && !def.localizable) {
      return err(commandError('command.not-localizable', 'This prop cannot be translated.'));
    }
    for (const [code, translated] of Object.entries(value.l10n ?? {})) {
      const checked = checkStatic(def, translated, `the "${code}" translation`);
      if (!checked.ok) return checked;
    }
    return ok(undefined);
  }

  if (def.bindable === false) {
    return err(commandError('command.not-bindable', 'This prop cannot be bound to data.'));
  }
  if (value.fallback !== undefined) {
    const checked = checkStatic(def, value.fallback, 'the fallback');
    if (!checked.ok) return checked;
  }
  if (value.kind === 'binding') {
    const path = parsePath(value.path);
    return path.ok ? ok(undefined) : err(invalidValue(path.error.message));
  }
  const compiled =
    value.mode === 'template' ? compileTemplate(value.expr) : compileExpression(value.expr);
  if (!compiled.ok) return err(invalidValue(compiled.error.message));
  if (value.l10n !== undefined && !def.localizable) {
    return err(commandError('command.not-localizable', 'This prop cannot be translated.'));
  }
  for (const [code, source] of Object.entries(value.l10n ?? {})) {
    if (source === undefined) continue;
    const translated = compileTemplate(source);
    if (!translated.ok)
      return err(invalidValue(`the "${code}" translation: ${translated.error.message}`));
  }
  return ok(undefined);
}

/** Whether `value` can carry translations: a static value, or an expression in template mode. */
const translatable = (value: Value): boolean =>
  value.kind === 'static' || (value.kind === 'expression' && value.mode === 'template');

function checkTranslation(
  def: PropDef,
  current: Value | undefined,
  value: Value,
): Result<void, CommandError> {
  if (!def.localizable) {
    return err(commandError('command.not-localizable', 'This prop cannot be translated.'));
  }
  if (value.kind === 'binding') {
    return err(commandError('command.not-translatable', 'A binding cannot be translated.'));
  }
  if (current === undefined) {
    return err(
      commandError(
        'command.no-base-value',
        'Set the default-language value before translating it.',
      ),
    );
  }
  if (!translatable(current)) {
    return err(
      commandError(
        'command.not-translatable',
        'Only a static value or a template can be translated; change the default-language value first.',
      ),
    );
  }
  if (value.kind !== current.kind || (value.kind === 'expression' && value.mode !== 'template')) {
    return err(
      commandError(
        'command.value-kind-mismatch',
        'A translation must be the same kind of value as the default-language value; changing the kind is only possible in the default language.',
      ),
    );
  }
  if (value.l10n !== undefined) {
    return err(invalidValue('a translation cannot carry translations of its own'));
  }
  if (value.kind === 'static') return checkStatic(def, value.value, 'the translation');
  const compiled = compileTemplate(value.expr);
  return compiled.ok ? ok(undefined) : err(invalidValue(compiled.error.message));
}

/**
 * `node.setProp` — sets a prop's `Value` (docs/commands.md, docs/i18n.md). The value is checked
 * against the component's `PropDef`: a static value by its kind's validator, a binding by path
 * syntax, an expression by its syntax, both only when the prop is `bindable`. With `locale` it
 * writes that language's translation instead (see `SetPropPayload`). Content locks apply; an
 * unknown prop is rejected. Coalesces by `prop:<id>:<prop>:<locale>`.
 */
export const setPropHandler: CommandHandler<SetPropCommand> = {
  type: 'node.setProp',
  schema: setPropSchema,
  mergeKey: (cmd) => `prop:${cmd.payload.id}:${cmd.payload.prop}:${cmd.payload.locale ?? ''}`,

  validate(doc, cmd, env) {
    const { id, prop, value, locale } = cmd.payload;
    const found = target(doc, env, id, prop);
    if (!found.ok) return found;
    const { node, def } = found.value;
    if (locale !== undefined) {
      return checkTranslation(def, node.props?.[prop] as Value | undefined, value);
    }
    return checkPropValue(def, value);
  },

  apply(draft, cmd) {
    const { id, prop, value, locale } = cmd.payload;
    const node = draft.nodes[id];
    if (node === undefined) return { affected: [] };
    const props = node.props ?? {};
    if (locale === undefined) {
      props[prop] = value as never;
    } else {
      const current = props[prop] as { l10n?: Record<string, unknown> } | undefined;
      if (current === undefined) return { affected: [] };
      const translation =
        value.kind === 'static'
          ? value.value
          : value.kind === 'expression'
            ? value.expr
            : undefined;
      current.l10n = { ...current.l10n, [locale]: translation };
    }
    node.props = props;
    return { affected: [id] };
  },
};

/**
 * `node.unsetProp` — removes a prop so the component's default applies again, or, with `locale`,
 * only that language's translation. Removing something that is not there changes nothing.
 * Coalesces like `node.setProp`.
 */
export const unsetPropHandler: CommandHandler<UnsetPropCommand> = {
  type: 'node.unsetProp',
  schema: unsetPropSchema,
  mergeKey: (cmd) => `prop:${cmd.payload.id}:${cmd.payload.prop}:${cmd.payload.locale ?? ''}`,

  validate(doc, cmd, env) {
    const found = target(doc, env, cmd.payload.id, cmd.payload.prop);
    return found.ok ? ok(undefined) : found;
  },

  apply(draft, cmd) {
    const { id, prop, locale } = cmd.payload;
    const node = draft.nodes[id];
    const props = node?.props;
    if (node === undefined || props === undefined || !Object.hasOwn(props, prop)) {
      return { affected: [] };
    }
    if (locale === undefined) {
      delete props[prop];
      if (Object.keys(props).length === 0) delete node.props;
      return { affected: [id] };
    }
    const current = props[prop] as { l10n?: Record<string, unknown> } | undefined;
    if (current?.l10n === undefined || !Object.hasOwn(current.l10n, locale))
      return { affected: [] };
    delete current.l10n[locale];
    if (Object.keys(current.l10n).length === 0) delete current.l10n;
    return { affected: [id] };
  },
};
