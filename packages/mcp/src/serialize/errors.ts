import type { BuilderDocument, Reason, ReasonCode, RegistryMeta } from '@buildr/core';
import { STYLE_GROUPS } from '@buildr/core';
import type { Command, CommandError } from '@buildr/core/commands';
import { coreCommandHandlers, createCommandRegistry } from '@buildr/core/commands';
import type { SessionError } from '../session/errors.ts';
import { allowedChildTypes, allowedParents, expandMatchers } from './structure.ts';
import { list, nearest, quote } from './text.ts';

/** What the explainers may look at to name the nearest valid alternative. */
export interface ExplainContext {
  readonly registry: RegistryMeta;
  readonly doc?: BuilderDocument | undefined;
  /** The batch the error came from; lets `commandIndex` point at the failing command. */
  readonly commands?: readonly Command[] | undefined;
}

/** A rejection an agent can act on: one sentence, plus the nearest valid alternatives. */
export interface AgentError {
  readonly code: string;
  /** One sentence saying what is wrong and, where useful, what would be right. */
  readonly message: string;
  /** Valid alternatives (component types, slot names, prop names, ...), best first. */
  readonly alternatives?: readonly string[];
  /** The node the problem is about, when known. */
  readonly nodeId?: string;
}

/** `message` plus the alternatives, as the single string a tool result carries. */
export function formatAgentError(error: AgentError): string {
  return error.alternatives && error.alternatives.length > 0
    ? `${error.message} Alternatives: ${list(error.alternatives, 15)}.`
    : error.message;
}

type Params = NonNullable<Reason['params']>;

function str(params: Params | undefined, key: string): string | undefined {
  const value = params?.[key];
  return typeof value === 'string' ? value : undefined;
}

function label(ctx: ExplainContext, type: string | undefined): string {
  if (type === undefined) return 'this component';
  return ctx.registry.get(type)?.label ? `${type}` : `"${type}"`;
}

type ReasonExplainer = (
  reason: Reason,
  ctx: ExplainContext,
) => Pick<AgentError, 'message' | 'alternatives'>;

const at = (reason: Reason): string | undefined => str(reason.params, 'nodeId');

/**
 * One explainer per `ReasonCode`: the `Record` type makes the compiler demand a new entry
 * whenever core adds a code, and a test enumerates the table against core's sources.
 */
export const REASON_EXPLAINERS: Readonly<Record<ReasonCode, ReasonExplainer>> = {
  'target-not-found': (r) => ({
    message: `The parent node "${str(r.params, 'parentId') ?? '?'}" does not exist; take a parent id from the outline.`,
  }),
  'node-not-found': (r) => ({
    message: `The node "${at(r) ?? '?'}" does not exist; take node ids from the outline.`,
  }),
  'unknown-component-type': (r, ctx) => {
    const type = str(r.params, 'type') ?? '?';
    const types = ctx.registry.list().map((m) => m.type);
    return {
      message: `"${type}" is not a component of this site.`,
      alternatives: nearest(type, types).length > 0 ? nearest(type, types) : types,
    };
  },
  'not-insertable': (r, ctx) => {
    const type = str(r.params, 'type') ?? '?';
    const parents = [...new Set(allowedParents(ctx.registry, type, false).map((p) => p.type))];
    return {
      message: `${type} cannot be inserted on its own; duplicate an existing one${
        parents.length > 0 ? ` or insert its parent (${list(parents)}) with it inside` : ''
      }.`,
      alternatives: parents,
    };
  },
  'root-only': (r, ctx) => ({
    message: `${label(ctx, str(r.params, 'type'))} is the document root; it already exists and cannot be inserted.`,
  }),
  'slot-not-found': (r, ctx) => {
    const parent = str(r.params, 'parentType') ?? '?';
    const slots = Object.keys(ctx.registry.get(parent)?.slots ?? {});
    return {
      message: `${parent} has no slot "${str(r.params, 'slot') ?? '?'}"${
        slots.length > 0
          ? `; its slots are: ${list(slots)}`
          : ' (it is a leaf and takes no children)'
      }.`,
      alternatives: slots,
    };
  },
  'slot-denied': (r, ctx) => slotRefusal(r, ctx),
  'slot-not-allowed': (r, ctx) => slotRefusal(r, ctx),
  'parent-denied': (r, ctx) => parentRefusal(r, ctx),
  'parent-not-allowed': (r, ctx) => parentRefusal(r, ctx),
  'missing-required-ancestor': (r, ctx) => {
    const type = str(r.params, 'type') ?? '?';
    const required = expandMatchers(
      ctx.registry,
      ctx.registry.get(type)?.parents?.requireAncestor ?? [],
    );
    return {
      message: `${type} must be nested inside ${required.length > 0 ? list(required) : 'a specific ancestor'}; insert that first and put ${type} inside it.`,
      alternatives: required,
    };
  },
  'heading-requires-phrasing': (r) => ({
    message: `${str(r.params, 'parentType') ?? 'The parent'} only accepts inline (phrasing) content, not ${str(r.params, 'childType') ?? 'this component'}; use text or a link instead.`,
  }),
  'nested-interactive': (r) => ({
    message: `${str(r.params, 'childType') ?? 'This component'} is interactive and cannot sit inside ${str(r.params, 'parentType') ?? 'another interactive component'}; move it out next to it.`,
  }),
  'nested-form': () => ({
    message: 'A form cannot be nested inside another form; put the second form next to the first.',
  }),
  'form-control-outside-form': (r) => ({
    message: `${str(r.params, 'childType') ?? 'A form control'} must be inside a buildr/form; insert a form first and put the field in it.`,
    alternatives: ['buildr/form'],
  }),
  'slot-max-exceeded': (r) => ({
    message: `Slot "${str(r.params, 'slot') ?? '?'}" of ${str(r.params, 'parentType') ?? 'the parent'} takes at most ${String(r.params?.['max'] ?? '?')} item(s); remove or replace one instead of adding.`,
  }),
  'slot-min-violation': (r) => ({
    message: `Slot "${str(r.params, 'slot') ?? '?'}" needs at least ${String(r.params?.['min'] ?? '?')} item(s), so the last one cannot be removed; replace it instead.`,
  }),
  'invalid-index': (r) => ({
    message: `Position ${String(r.params?.['at'] ?? '?')} is outside slot "${str(r.params, 'slot') ?? '?'}"; use 0 to append at the start or the number of existing children to append at the end.`,
  }),
  cycle: () => ({
    message:
      'A node cannot be moved inside itself or its own descendants; pick a target outside its subtree.',
  }),
  'locked-structure': (r) => ({
    message: `The structure here is locked${at(r) ? ` (node ${at(r)})` : ''} by a template; only a person can unlock it in the editor, so edit content in its editable regions instead.`,
  }),
  'locked-content': (r) => ({
    message: `The content of ${at(r) ?? 'this node'} is locked by a template; only a person can unlock it in the editor.`,
  }),
  'locked-style': (r) => ({
    message: `The style of ${at(r) ?? 'this node'} is locked by a template; only a person can unlock it in the editor.`,
  }),
  'not-removable': (r, ctx) => ({
    message: `${label(ctx, str(r.params, 'type'))} cannot be removed; hide it with a style or condition instead.`,
  }),
  'not-draggable': (r, ctx) => ({
    message: `${label(ctx, str(r.params, 'type'))} cannot be moved; remove and insert a new one where you need it.`,
  }),
  'cannot-remove-root': () => ({
    message: 'The page root cannot be removed; remove its children instead.',
  }),
  'cannot-move-root': () => ({ message: 'The page root cannot be moved.' }),
};

function slotRefusal(r: Reason, ctx: ExplainContext): Pick<AgentError, 'message' | 'alternatives'> {
  const parent = str(r.params, 'parentType') ?? '?';
  const slot = str(r.params, 'slot') ?? 'default';
  const type = str(r.params, 'type') ?? '?';
  const allowed = allowedChildTypes(ctx.registry, parent, slot);
  return {
    message: `${type} cannot be placed in slot "${slot}" of ${parent}; allowed children of ${parent} are: ${list(allowed, 20)}.`,
    alternatives: allowed,
  };
}

function parentRefusal(
  r: Reason,
  ctx: ExplainContext,
): Pick<AgentError, 'message' | 'alternatives'> {
  const parent = str(r.params, 'parentType') ?? '?';
  const type = str(r.params, 'type') ?? '?';
  const parents = [...new Set(allowedParents(ctx.registry, type).map((p) => p.type))];
  return {
    message: `${type} cannot be placed inside ${parent}; ${
      parents.length > 0 ? `it can only go inside: ${list(parents, 15)}` : 'it has no valid parent'
    }.`,
    alternatives: parents,
  };
}

/** Turns a rule rejection (`canInsert`, `canMove`, `canRemove`, `canEdit`) into an `AgentError`. */
export function explainReason(reason: Reason, ctx: ExplainContext): AgentError {
  const explainer = REASON_EXPLAINERS[reason.code];
  const nodeId = str(reason.params, 'nodeId') ?? str(reason.params, 'parentId');
  const explained = explainer
    ? explainer(reason, ctx)
    : { message: reason.message.endsWith('.') ? reason.message : `${reason.message}.` };
  return { code: reason.code, ...explained, ...(nodeId !== undefined ? { nodeId } : {}) };
}

type CommandExplainer = (
  error: CommandError,
  ctx: ExplainContext,
  command: Command | undefined,
) => Pick<AgentError, 'message' | 'alternatives'>;

const sentence = (text: string): string => (/[.!?]$/.test(text) ? text : `${text}.`);

const plain =
  (advice = ''): CommandExplainer =>
  (error) => ({ message: `${sentence(error.message)}${advice ? ` ${advice}` : ''}` });

function payloadNodeType(
  ctx: ExplainContext,
  command: Command | undefined,
): { readonly id: string | undefined; readonly type: string | undefined } {
  const payload = command?.payload as { id?: unknown } | undefined;
  const id = typeof payload?.id === 'string' ? payload.id : undefined;
  return { id, type: id !== undefined ? ctx.doc?.nodes[id]?.type : undefined };
}

/** One explainer per command error code core emits; unknown codes fall back to core's message. */
export const COMMAND_EXPLAINERS: Readonly<Record<string, CommandExplainer>> = {
  'command.invalid-command': plain(
    'A command is { "type": "node.insert" | ..., "payload": { ... } }.',
  ),
  'command.unknown-type': (error) => {
    const types = createCommandRegistry(coreCommandHandlers).types;
    return {
      message: `${sentence(error.message)} Valid command types: ${list(types, 20)}.`,
      alternatives: types,
    };
  },
  'command.invalid-payload': plain('Fix the payload to match the command and retry.'),
  'command.rejected': (error, ctx) =>
    error.reason ? explainReason(error.reason, ctx) : { message: sentence(error.message) },
  'command.invariant-violated': plain(
    'The change would leave the document inconsistent, so it was not applied.',
  ),
  'command.invalid-patches': plain('Reopen the document and retry.'),
  'command.cannot-duplicate-root': plain('Duplicate a child of the page instead.'),
  'command.cannot-unwrap-root': plain(),
  'command.cannot-wrap-root': plain('Wrap a child of the page instead.'),
  'command.component-version-mismatch': plain(
    'Reopen the document; the component changed since it was opened.',
  ),
  'command.duplicate-anchor': plain(
    'Anchors (HTML ids) are unique per document; pick another one.',
  ),
  'command.invalid-attr': plain(),
  'command.invalid-fragment': plain(
    'Build the content with insert_nodes trees rather than raw fragments.',
  ),
  'command.invalid-layer': plain(
    'A style layer is the base, one breakpoint (bp) or one state, never both.',
  ),
  'command.invalid-side': plain(
    'Sides are top, right, bottom, left; corners are topLeft, topRight, bottomRight, bottomLeft.',
  ),
  'command.invalid-value': plain(),
  'command.limit-exceeded': plain('Split the change into smaller steps or remove content first.'),
  'command.move-not-siblings': plain('Move nodes that share a parent one at a time.'),
  'command.no-base-value': plain('Set the default-language value first, then add translations.'),
  'command.not-allowed-in-state': plain(),
  'command.not-bindable': (error, ctx, command) => ({
    message: `${sentence(error.message)} Give it a plain static value${propHint(ctx, command)}.`,
  }),
  'command.not-in-document': plain('Take node ids from the outline.'),
  'command.not-localizable': plain(
    'Only localizable props take translations; give it one value for all languages.',
  ),
  'command.not-translatable': plain(
    'Translations apply to static values and template expressions only.',
  ),
  'command.unknown-prop': (error, ctx, command) => {
    const { type } = payloadNodeType(ctx, command);
    const props = Object.keys(ctx.registry.get(type ?? '')?.props ?? {});
    const wanted = (command?.payload as { prop?: unknown } | undefined)?.prop;
    const close = typeof wanted === 'string' ? nearest(wanted, props) : [];
    return {
      message: `${sentence(error.message)}${props.length > 0 ? ` Its props are: ${list(props)}.` : ''}`,
      alternatives: close.length > 0 ? close : props,
    };
  },
  'command.unknown-style-property': (error) => ({
    message: `${sentence(error.message)} Style groups: ${STYLE_GROUPS.join(', ')}; get_style_reference lists the properties of each.`,
    alternatives: [...STYLE_GROUPS],
  }),
  'command.unlock-not-permitted': plain(
    'Only a person can unlock template content, in the editor.',
  ),
  'command.unwrap-has-other-slots': plain("Move or remove the other slots' content first."),
  'command.value-kind-mismatch': plain(
    'A translation must be the same kind of value as the base value.',
  ),
  'command.wrap-not-contiguous': plain('Wrap nodes that are next to each other.'),
  'command.wrap-not-siblings': plain('Wrap nodes that share one parent.'),
};

function propHint(ctx: ExplainContext, command: Command | undefined): string {
  const { type } = payloadNodeType(ctx, command);
  const prop = (command?.payload as { prop?: unknown } | undefined)?.prop;
  const def =
    type !== undefined && typeof prop === 'string'
      ? ctx.registry.get(type)?.props[prop]
      : undefined;
  return def ? ` (default ${quote(JSON.stringify(def.default), 30)})` : '';
}

/** Turns a command or batch failure into an `AgentError`, naming the failing command. */
export function explainCommandError(error: CommandError, ctx: ExplainContext): AgentError {
  const command = error.commandIndex !== undefined ? ctx.commands?.[error.commandIndex] : undefined;
  const explainer = COMMAND_EXPLAINERS[error.code];
  const explained = explainer
    ? explainer(error, ctx, command)
    : { message: sentence(error.message) };
  const { id } = payloadNodeType(ctx, command);
  const where =
    error.commandIndex !== undefined
      ? `Command ${error.commandIndex + 1}${command ? ` (${command.type})` : ''}: `
      : '';
  return {
    code: error.code,
    message: `${where}${explained.message}`,
    ...(explained.alternatives ? { alternatives: explained.alternatives } : {}),
    ...(id !== undefined ? { nodeId: id } : {}),
  };
}

const SESSION_ADVICE: Partial<Record<SessionError['code'], string>> = {
  'session-not-found': 'Open the document again with open_document.',
  'session-limit': 'Close a session you no longer need first.',
  'manifest-changed': 'Open the document again to pick up the new components.',
  'unsaved-changes': 'Save the document, or close it with discard to drop the changes.',
  'nothing-to-undo': '',
  'nothing-to-redo': '',
  'read-only': 'It cannot be changed with this account.',
};

/** Turns a session failure (including a rejected batch) into an `AgentError`. */
export function explainSessionError(error: SessionError, ctx: ExplainContext): AgentError {
  if (error.code === 'command-rejected' && error.command) {
    const explained = explainCommandError(error.command, ctx);
    return { ...explained, message: `${explained.message} Nothing was applied.` };
  }
  const advice = SESSION_ADVICE[error.code];
  return {
    code: error.code,
    message: `${sentence(error.message)}${advice ? ` ${advice}` : ''}`,
  };
}
