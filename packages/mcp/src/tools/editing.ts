// Editing tools (PB-137, docs/mcp.md#tool-reference). Every tool is one `session.apply`, that is
// one core `executeBatch`: all or nothing, one undo step, invariants checked after every command.
// A tool that cannot express something leaves it to `apply_commands`, the escape hatch.
import { createIndex, fromTree, type Result, type Value } from '@next-buildr/core';
import type { Command } from '@next-buildr/core/commands';
import { z } from 'zod';
import { parseTreeInput, TREE_NODE_REF, treeInputDefs } from '../serialize/index.ts';
import type { McpTool, McpToolResult } from '../server.ts';
import type { EditSession, SessionChange } from '../session/index.ts';
import {
  errorResult,
  nodeIdsOf,
  outlineText,
  parseArguments,
  requireSession,
  sessionFailure,
  sessionIdSchema,
  sessionSummary,
  type ToolFactoryOptions,
  templateFragment,
  textResult,
  withRegistryVersions,
} from './documents.ts';

const MAX_LISTED_CHANGES = 15;
const nodeIdSchema = z.string().min(1).max(64);
const nodeIdsSchema = z.array(nodeIdSchema).min(1).max(500);
const localeSchema = z.string().min(1).max(35);

/** Clients sometimes send a JSON value as a string; accept that for the big structured arguments. */
function looseJson<T extends z.ZodType>(schema: T) {
  return z.preprocess((raw) => {
    if (typeof raw !== 'string') return raw;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  }, schema);
}

// --- Positions ------------------------------------------------------------------------------------

const positionShape = {
  parentId: nodeIdSchema.optional(),
  slot: z.string().min(1).max(64).optional(),
  index: z.int().min(0).optional(),
  after: nodeIdSchema.optional(),
};

const POSITION_PROPERTIES = {
  parentId: {
    type: 'string',
    description:
      'Node to insert into. Together with slot and index. Default: the page root (append to its content).',
  },
  slot: {
    type: 'string',
    description:
      'Slot of parentId, default "default". Components with several slots list them in describe_component.',
  },
  index: {
    type: 'integer',
    minimum: 0,
    description: 'Position in the slot (0 = first). Default: the end.',
  },
  after: {
    type: 'string',
    description: 'Alternative to parentId/slot/index: place right after this sibling node.',
  },
} as const;

interface Position {
  readonly parentId: string;
  readonly slot: string;
  readonly index: number;
}

function resolvePosition(
  session: EditSession,
  input: {
    parentId?: string | undefined;
    slot?: string | undefined;
    index?: number | undefined;
    after?: string | undefined;
  },
): Result<Position, string> {
  const { doc } = session;
  const fail = (message: string): Result<Position, string> => ({ ok: false, error: message });
  if (input.after !== undefined) {
    if (input.parentId !== undefined || input.slot !== undefined || input.index !== undefined) {
      return fail('Give either "after" or parentId/slot/index, not both.');
    }
    if (!Object.hasOwn(doc.nodes, input.after)) {
      return fail(`There is no node "${input.after}" in this document; ids come from get_outline.`);
    }
    const index = createIndex(doc);
    const parentId = index.parentOf[input.after];
    const slot = index.slotOf[input.after];
    const at = index.indexOf[input.after];
    if (parentId === undefined || slot === undefined || at === undefined) {
      return fail('The page root has no siblings; insert into it with parentId instead.');
    }
    return { ok: true, value: { parentId, slot, index: at + 1 } };
  }
  const parentId = input.parentId ?? doc.root;
  const parent = Object.hasOwn(doc.nodes, parentId) ? doc.nodes[parentId] : undefined;
  if (parent === undefined) {
    return fail(`There is no node "${parentId}" in this document; ids come from get_outline.`);
  }
  const slotNames = Object.keys(session.registry.get(parent.type)?.slots ?? {});
  const slot =
    input.slot ??
    (slotNames.includes('default') || slotNames.length !== 1
      ? 'default'
      : (slotNames[0] ?? 'default'));
  if (slotNames.length === 0) {
    return fail(`${parent.type} is a leaf component and takes no children; pick a container.`);
  }
  if (!slotNames.includes(slot)) {
    return fail(`${parent.type} has no slot "${slot}". Its slots: ${slotNames.join(', ')}.`);
  }
  const length = parent.slots?.[slot]?.length ?? 0;
  const index = input.index ?? length;
  if (index > length) {
    return fail(
      `Slot "${slot}" of ${parentId} has ${length} child(ren); index ${index} is out of range (0..${length}).`,
    );
  }
  return { ok: true, value: { parentId, slot, index } };
}

// --- Results --------------------------------------------------------------------------------------

/** One-line outline entries of the changed nodes that still exist (capped). */
function changedLines(session: EditSession, ids: readonly string[]): string[] {
  const lines: string[] = [];
  for (const id of ids) {
    if (lines.length >= MAX_LISTED_CHANGES) break;
    if (!Object.hasOwn(session.doc.nodes, id)) continue;
    const text = outlineText(session, { nodeId: id, depth: 0 });
    lines.push(text.split('\n')[0] ?? text);
  }
  if (ids.length > lines.length) lines.push(`(+${ids.length - lines.length} more changed)`);
  return lines;
}

function applied(
  session: EditSession,
  change: SessionChange,
  before: ReadonlySet<string>,
  headline: string,
): McpToolResult {
  const after = nodeIdsOf(session.doc);
  const newIds = [...after].filter((id) => !before.has(id));
  const removedCount = [...before].filter((id) => !after.has(id)).length;
  const changed = [...new Set(change.affected)].filter(
    (id) => after.has(id) && !newIds.includes(id),
  );
  const parts: string[] = [`${headline} Nothing was stored yet: call save when you are done.`];
  if (newIds.length > 0) {
    const roots = change.select.filter((id) => after.has(id));
    parts.push(
      `New nodes (${newIds.length}):`,
      ...(roots.length > 0 ? roots : newIds.slice(0, 1)).map((id) =>
        outlineText(session, { nodeId: id, depth: 2 }),
      ),
    );
  }
  if (removedCount > 0) parts.push(`Removed ${removedCount} node(s).`);
  if (changed.length > 0) parts.push('Changed:', ...changedLines(session, changed));
  parts.push(
    `Document: ${after.size} nodes, ${change.dirty ? 'unsaved changes' : 'no unsaved changes'}${change.canUndo ? ', undo available' : ''}.`,
  );
  return textResult(parts.join('\n'), {
    ...sessionSummary(session),
    applied: true,
    newIds,
    changedIds: changed,
    removedCount,
    selected: change.select,
  });
}

/** Runs `commands` on the session and reports the outcome for an agent. */
function run(
  session: EditSession,
  commands: readonly Command[],
  headline: string,
  label?: string,
): McpToolResult {
  const before = nodeIdsOf(session.doc);
  const result = session.apply(commands, label === undefined ? undefined : { label });
  if (!result.ok) return sessionFailure(result.error, { session, commands });
  return applied(session, result.value, before, headline);
}

const editAnnotations = (
  title: string,
  extra: { destructiveHint?: boolean; idempotentHint?: boolean } = {},
) => ({
  title,
  readOnlyHint: false,
  destructiveHint: extra.destructiveHint ?? false,
  idempotentHint: extra.idempotentHint ?? false,
  openWorldHint: false,
});

// --- Values ---------------------------------------------------------------------------------------

/** A plain JSON value is shorthand for a static value; a `{ kind: ... }` object is a full `Value`. */
function toValue(raw: unknown): Value {
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    const kind = (raw as { kind?: unknown }).kind;
    if (kind === 'static' || kind === 'binding' || kind === 'expression') return raw as Value;
  }
  return { kind: 'static', value: raw };
}

const VALUE_HELP =
  'A plain JSON value is a static value. Use {"kind":"binding","path":"post.title"} to bind data, {"kind":"expression","expr":"..."} for a formula, or {"kind":"static","value":"Hello","l10n":{"pl":"Cześć"}} to carry translations.';

// --- insert_nodes -----------------------------------------------------------------------------------

const insertArgs = z.strictObject({
  sessionId: sessionIdSchema,
  tree: looseJson(z.unknown()).optional(),
  template: z.string().min(1).max(200).optional(),
  variant: z.string().min(1).max(100).optional(),
  ...positionShape,
});

const LONE_ITEM_HINT =
  ' Insert the parent tree instead (for example the whole list with its items), or use duplicate_nodes on an existing item.';

function insertNodes({ store }: ToolFactoryOptions): McpTool {
  return {
    name: 'insert_nodes',
    description:
      'Inserts new content: either a "tree" (a nested { type, props, children | slots } you write) or a "template" id (see list_templates), at a position. Give parentId (+ slot, index) or "after" a sibling; with no position it appends to the page. The whole insert is validated first and is all or nothing: on a problem you get every issue with the valid alternatives and nothing changes. Components that only make sense inside a parent (list-item, accordion-item) cannot be inserted alone: insert the parent tree, or use duplicate_nodes on an existing one. Returns the new node ids and their outline.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'sessionId of the open document' },
        tree: {
          ...TREE_NODE_REF,
          description: 'The content to insert. Use either tree or template.',
        },
        template: {
          type: 'string',
          description:
            'Template id to insert, for example "buildr/hero". Use either tree or template.',
        },
        variant: {
          type: 'string',
          description: 'A variant of the template (see describe_template).',
        },
        ...POSITION_PROPERTIES,
      },
      required: ['sessionId'],
      additionalProperties: false,
      $defs: treeInputDefs(),
    },
    annotations: editAnnotations('Insert nodes'),
    async handler(args) {
      const parsed = parseArguments(insertArgs, args);
      if (!parsed.ok) return parsed.error;
      const input = parsed.value;
      if ((input.tree === undefined) === (input.template === undefined)) {
        return errorResult('Give exactly one of "tree" or "template".');
      }
      const found = await requireSession(store, input.sessionId);
      if (!found.ok) return found.error;
      const session = found.value;
      const position = resolvePosition(session, input);
      if (!position.ok) return errorResult(position.error);

      let fragment: ReturnType<typeof fromTree>;
      let what: string;
      if (input.template !== undefined) {
        const made = templateFragment(session.registry, input.template, input.variant);
        if (!made.ok) return errorResult(made.error);
        fragment = made.value;
        what = `template ${input.template}`;
      } else {
        const tree = parseTreeInput(session.registry, input.tree);
        if (!tree.ok) {
          const hint = tree.error.message.includes('cannot be inserted on its own')
            ? LONE_ITEM_HINT
            : '';
          return errorResult(
            `The tree is not valid, nothing was inserted.\n${tree.error.message}${hint}`,
            {
              error: {
                code: tree.error.code,
                message: tree.error.message,
                issues: tree.error.issues,
              },
            },
          );
        }
        fragment = withRegistryVersions(fromTree(tree.value), session.registry);
        what = `${tree.value.type} tree`;
      }
      const { parentId, slot, index } = position.value;
      return run(
        session,
        [{ type: 'node.insert', payload: { parentId, slot, index, fragment } }],
        `Inserted ${what} into ${parentId} slot "${slot}" at index ${index}.`,
        `insert ${what}`,
      );
    },
  };
}

// --- update_node ------------------------------------------------------------------------------------

const styleValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.record(z.string(), z.union([z.string(), z.number()])),
]);
const layerShape = {
  bp: z.string().min(1).max(32).optional(),
  state: z.enum(['hover', 'focus-visible', 'active']).optional(),
};
const styleSet = z.strictObject({
  group: z.string().min(1).max(32),
  property: z.string().min(1).max(32),
  side: z.string().min(1).max(16).optional(),
  value: styleValue,
  ...layerShape,
});
const styleUnset = z.strictObject({
  group: z.string().min(1).max(32),
  property: z.string().min(1).max(32),
  side: z.string().min(1).max(16).optional(),
  ...layerShape,
});
const attributesSchema = z.strictObject({
  name: z.string().max(120).nullable().optional(),
  anchor: z.string().max(120).nullable().optional(),
  region: z.string().max(64).nullable().optional(),
  lock: z.record(z.string(), z.unknown()).nullable().optional(),
  visibleIf: z.unknown().optional(),
});

const updateArgs = z.strictObject({
  sessionId: sessionIdSchema,
  nodeId: nodeIdSchema,
  props: z.record(z.string().max(64), z.unknown()).optional(),
  unsetProps: z.array(z.string().max(64)).max(100).optional(),
  locale: localeSchema.optional(),
  styles: z.array(styleSet).max(100).optional(),
  unsetStyles: z.array(styleUnset).max(100).optional(),
  resetStyles: z.boolean().optional(),
  attributes: attributesSchema.optional(),
});

function updateNode({ store }: ToolFactoryOptions): McpTool {
  return {
    name: 'update_node',
    description:
      'Changes one node in a single atomic step: set props, unset props, set or unset style properties, and set attributes (name, anchor, region, lock, visibleIf). With "locale", props/unsetProps write that language\'s translation instead of the default-language value (the default value must exist first, and only props marked localizable can be translated); translations are stored beside the value, never replacing it. Style entries name a group and property (see get_style_reference) and apply to the base layer, or to a breakpoint via "bp" and a state via "state". Locked content or styles are refused with an explanation. Use get_node first to see what is set.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'sessionId of the open document' },
        nodeId: { type: 'string', description: 'The node to change (from get_outline).' },
        props: {
          type: 'object',
          description: `Props to set, by name. ${VALUE_HELP}`,
          additionalProperties: true,
        },
        unsetProps: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Props to reset to the component default (or, with locale, to remove that translation).',
        },
        locale: {
          type: 'string',
          description:
            "Write props/unsetProps as this language's translation instead of the default-language value.",
        },
        styles: {
          type: 'array',
          description: 'Style properties to set.',
          items: {
            type: 'object',
            properties: {
              group: { type: 'string', description: 'Style group, e.g. "spacing", "typography".' },
              property: {
                type: 'string',
                description: 'Property in the group, e.g. "padding", "fontSize".',
              },
              side: {
                type: 'string',
                description: 'One side or corner of a box property, e.g. "top".',
              },
              value: {
                description:
                  'A value in the property\'s grammar; design tokens are written "$space.4". For a box property without side, an object per side.',
              },
              bp: { type: 'string', description: 'Breakpoint name; omit for the base layer.' },
              state: { type: 'string', enum: ['hover', 'focus-visible', 'active'] },
            },
            required: ['group', 'property', 'value'],
            additionalProperties: false,
          },
        },
        unsetStyles: {
          type: 'array',
          description: 'Style properties to remove.',
          items: {
            type: 'object',
            properties: {
              group: { type: 'string' },
              property: { type: 'string' },
              side: { type: 'string' },
              bp: { type: 'string' },
              state: { type: 'string', enum: ['hover', 'focus-visible', 'active'] },
            },
            required: ['group', 'property'],
            additionalProperties: false,
          },
        },
        resetStyles: {
          type: 'boolean',
          description: 'Remove every style override of the node first.',
        },
        attributes: {
          type: 'object',
          description: 'Node attributes; null clears one.',
          properties: {
            name: { type: ['string', 'null'], description: 'Label in the layers panel.' },
            anchor: {
              type: ['string', 'null'],
              description: 'HTML id for in-page links, unique per document.',
            },
            region: { type: ['string', 'null'], description: 'Layout region name.' },
            lock: {
              type: ['object', 'null'],
              description: '{ "structure": true, "content": true, "style": true }',
            },
            visibleIf: { description: `Condition for showing the node. ${VALUE_HELP}` },
          },
          additionalProperties: false,
        },
      },
      required: ['sessionId', 'nodeId'],
      additionalProperties: false,
    },
    annotations: editAnnotations('Update a node', { idempotentHint: true }),
    async handler(args) {
      const parsed = parseArguments(updateArgs, args);
      if (!parsed.ok) return parsed.error;
      const input = parsed.value;
      const found = await requireSession(store, input.sessionId);
      if (!found.ok) return found.error;
      const session = found.value;
      const id = input.nodeId;
      const commands: Command[] = [];
      if (input.resetStyles === true) commands.push({ type: 'node.resetStyles', payload: { id } });
      for (const [prop, raw] of Object.entries(input.props ?? {})) {
        commands.push({
          type: 'node.setProp',
          payload: {
            id,
            prop,
            value: toValue(raw),
            ...(input.locale === undefined ? {} : { locale: input.locale }),
          },
        });
      }
      for (const prop of input.unsetProps ?? []) {
        commands.push({
          type: 'node.unsetProp',
          payload: { id, prop, ...(input.locale === undefined ? {} : { locale: input.locale }) },
        });
      }
      for (const { bp, state, value, group, property, side } of input.styles ?? []) {
        commands.push({
          type: 'node.setStyle',
          payload: {
            id,
            layer: { ...(bp ? { bp } : {}), ...(state ? { state } : {}) },
            group,
            property,
            ...(side ? { side } : {}),
            value,
          },
        });
      }
      for (const { bp, state, group, property, side } of input.unsetStyles ?? []) {
        commands.push({
          type: 'node.unsetStyle',
          payload: {
            id,
            layer: { ...(bp ? { bp } : {}), ...(state ? { state } : {}) },
            group,
            property,
            ...(side ? { side } : {}),
          },
        });
      }
      for (const key of ['name', 'anchor', 'region', 'lock', 'visibleIf'] as const) {
        const value = input.attributes?.[key];
        if (value === undefined) continue;
        commands.push({
          type: 'node.setAttr',
          payload: {
            id,
            key,
            value: key === 'visibleIf' && value !== null ? toValue(value) : value,
          },
        });
      }
      if (commands.length === 0) {
        return errorResult(
          'Nothing to update: give props, unsetProps, styles, unsetStyles, resetStyles or attributes.',
        );
      }
      return run(
        session,
        commands,
        `Updated ${id} (${commands.length} change(s)).`,
        `update ${id}`,
      );
    },
  };
}

// --- move / remove / duplicate / wrap / unwrap ------------------------------------------------------

const moveArgs = z.strictObject({
  sessionId: sessionIdSchema,
  nodeIds: nodeIdsSchema,
  ...positionShape,
});

function moveNodes({ store }: ToolFactoryOptions): McpTool {
  return {
    name: 'move_nodes',
    description:
      'Moves nodes (with everything inside them) to a new position: parentId (+ slot, index) or "after" a sibling. Order is kept. The target must accept them (slot rules, locks); a node cannot move into itself.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'sessionId of the open document' },
        nodeIds: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          description: 'Nodes to move.',
        },
        ...POSITION_PROPERTIES,
      },
      required: ['sessionId', 'nodeIds'],
      additionalProperties: false,
    },
    annotations: editAnnotations('Move nodes'),
    async handler(args) {
      const parsed = parseArguments(moveArgs, args);
      if (!parsed.ok) return parsed.error;
      const found = await requireSession(store, parsed.value.sessionId);
      if (!found.ok) return found.error;
      const session = found.value;
      const position = resolvePosition(session, parsed.value);
      if (!position.ok) return errorResult(position.error);
      const { parentId, slot, index } = position.value;
      return run(
        session,
        [{ type: 'node.move', payload: { ids: parsed.value.nodeIds, parentId, slot, index } }],
        `Moved ${parsed.value.nodeIds.length} node(s) to ${parentId} slot "${slot}" at index ${index}.`,
      );
    },
  };
}

const idsArgs = z.strictObject({ sessionId: sessionIdSchema, nodeIds: nodeIdsSchema });

function removeNodes({ store }: ToolFactoryOptions): McpTool {
  return {
    name: 'remove_nodes',
    description:
      'Removes nodes and everything inside them. The page root cannot be removed and locked structure is refused. Can be reverted with undo until the session ends.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'sessionId of the open document' },
        nodeIds: { type: 'array', items: { type: 'string' }, minItems: 1 },
      },
      required: ['sessionId', 'nodeIds'],
      additionalProperties: false,
    },
    annotations: editAnnotations('Remove nodes', { destructiveHint: true, idempotentHint: true }),
    async handler(args) {
      const parsed = parseArguments(idsArgs, args);
      if (!parsed.ok) return parsed.error;
      const found = await requireSession(store, parsed.value.sessionId);
      if (!found.ok) return found.error;
      return run(
        found.value,
        [{ type: 'node.remove', payload: { ids: parsed.value.nodeIds } }],
        `Removed ${parsed.value.nodeIds.length} node tree(s).`,
      );
    },
  };
}

function duplicateNodes({ store }: ToolFactoryOptions): McpTool {
  return {
    name: 'duplicate_nodes',
    description:
      'Duplicates nodes (with everything inside them) right after the originals, with new ids. This is also the way to add another list-item or accordion-item: duplicate an existing one, then update_node the copy.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'sessionId of the open document' },
        nodeIds: { type: 'array', items: { type: 'string' }, minItems: 1 },
      },
      required: ['sessionId', 'nodeIds'],
      additionalProperties: false,
    },
    annotations: editAnnotations('Duplicate nodes'),
    async handler(args) {
      const parsed = parseArguments(idsArgs, args);
      if (!parsed.ok) return parsed.error;
      const found = await requireSession(store, parsed.value.sessionId);
      if (!found.ok) return found.error;
      return run(
        found.value,
        [{ type: 'node.duplicate', payload: { ids: parsed.value.nodeIds } }],
        `Duplicated ${parsed.value.nodeIds.length} node(s).`,
      );
    },
  };
}

const wrapArgs = z.strictObject({
  sessionId: sessionIdSchema,
  nodeIds: nodeIdsSchema,
  wrapper: z.strictObject({
    type: z.string().min(1).max(64),
    props: z.record(z.string().max(64), z.unknown()).optional(),
  }),
});

function wrapNodes({ store }: ToolFactoryOptions): McpTool {
  return {
    name: 'wrap_nodes',
    description:
      'Wraps contiguous sibling nodes in a new container, for example a stack around a heading and a paragraph. The wrapper takes their place and they become its children.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'sessionId of the open document' },
        nodeIds: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          description: 'Adjacent siblings, in order.',
        },
        wrapper: {
          type: 'object',
          properties: {
            type: { type: 'string', description: 'Container component, e.g. "buildr/stack".' },
            props: {
              type: 'object',
              additionalProperties: true,
              description: `Wrapper props. ${VALUE_HELP}`,
            },
          },
          required: ['type'],
          additionalProperties: false,
        },
      },
      required: ['sessionId', 'nodeIds', 'wrapper'],
      additionalProperties: false,
    },
    annotations: editAnnotations('Wrap nodes'),
    async handler(args) {
      const parsed = parseArguments(wrapArgs, args);
      if (!parsed.ok) return parsed.error;
      const { sessionId, nodeIds, wrapper } = parsed.value;
      const found = await requireSession(store, sessionId);
      if (!found.ok) return found.error;
      const props = Object.fromEntries(
        Object.entries(wrapper.props ?? {}).map(([name, raw]) => [name, toValue(raw)]),
      );
      return run(
        found.value,
        [
          {
            type: 'node.wrap',
            payload: {
              ids: nodeIds,
              wrapper: { type: wrapper.type, ...(Object.keys(props).length > 0 ? { props } : {}) },
            },
          },
        ],
        `Wrapped ${nodeIds.length} node(s) in ${wrapper.type}.`,
      );
    },
  };
}

const unwrapArgs = z.strictObject({ sessionId: sessionIdSchema, nodeId: nodeIdSchema });

function unwrapNode({ store }: ToolFactoryOptions): McpTool {
  return {
    name: 'unwrap_node',
    description:
      'Replaces a container by its own children: the children of its "default" slot take its place and the container itself is removed. The opposite of wrap_nodes.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'sessionId of the open document' },
        nodeId: { type: 'string', description: 'The container to dissolve.' },
      },
      required: ['sessionId', 'nodeId'],
      additionalProperties: false,
    },
    annotations: editAnnotations('Unwrap a node', { destructiveHint: true }),
    async handler(args) {
      const parsed = parseArguments(unwrapArgs, args);
      if (!parsed.ok) return parsed.error;
      const found = await requireSession(store, parsed.value.sessionId);
      if (!found.ok) return found.error;
      return run(
        found.value,
        [{ type: 'node.unwrap', payload: { id: parsed.value.nodeId } }],
        `Unwrapped ${parsed.value.nodeId}.`,
      );
    },
  };
}

// --- apply_commands ---------------------------------------------------------------------------------

const applyArgs = z.strictObject({
  sessionId: sessionIdSchema,
  commands: looseJson(
    z.array(z.strictObject({ type: z.string().min(1).max(64), payload: z.unknown() })).min(1),
  ),
  label: z.string().max(120).optional(),
});

function applyCommands({ store }: ToolFactoryOptions): McpTool {
  return {
    name: 'apply_commands',
    description: [
      'Escape hatch: applies raw Buildr commands as one atomic batch (all or nothing, one undo step). Prefer the specific tools; use this for combinations they cannot express, for example several different changes at once. Commands, with their payload:',
      '- node.insert { parentId, slot, index, fragment } (fragment: { format: "buildr/fragment", schemaVersion: 1, components: {type: version}, roots: [id], nodes: {id: node} })',
      '- node.remove { ids }',
      '- node.move { ids, parentId, slot, index }',
      '- node.setProp { id, prop, value: Value, locale? } / node.unsetProp { id, prop, locale? }',
      '- node.setStyle { id, layer: { bp?, state? }, group, property, side?, value } / node.unsetStyle { id, layer, group, property, side? } / node.resetStyles { id, layer? }',
      '- node.duplicate { ids }',
      '- node.wrap { ids, wrapper: { type, props?: {name: Value} } } / node.unwrap { id }',
      '- node.setAttr { id, key: "name" | "anchor" | "lock" | "region" | "visibleIf", value | null }',
      'A Value is { "kind": "static", "value": ... }, { "kind": "binding", "path": "..." } or { "kind": "expression", "expr": "..." }, optionally with "l10n" translations. A rejected command names its position in the batch and nothing is applied. Ids of nodes created by node.insert are chosen by the server and returned.',
    ].join('\n'),
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'sessionId of the open document' },
        commands: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', description: 'A command type, e.g. "node.setProp".' },
              payload: { type: 'object', description: 'The command payload.' },
            },
            required: ['type', 'payload'],
            additionalProperties: false,
          },
        },
        label: { type: 'string', description: 'Optional name of this change.' },
      },
      required: ['sessionId', 'commands'],
      additionalProperties: false,
    },
    annotations: editAnnotations('Apply commands', { destructiveHint: true }),
    async handler(args) {
      const parsed = parseArguments(applyArgs, args);
      if (!parsed.ok) return parsed.error;
      const { sessionId, commands, label } = parsed.value;
      if (commands.some((c) => c.type === 'doc.replace')) {
        return errorResult(
          'doc.replace is not available here: it swaps the whole document and erases undo history. Use open_document to reload, and the node.* commands to edit.',
        );
      }
      const found = await requireSession(store, sessionId);
      if (!found.ok) return found.error;
      return run(
        found.value,
        commands as Command[],
        `Applied ${commands.length} command(s).`,
        label,
      );
    },
  };
}

// --- undo / redo ------------------------------------------------------------------------------------

const historyArgs = z.strictObject({ sessionId: sessionIdSchema });

function historyTool({ store }: ToolFactoryOptions, direction: 'undo' | 'redo'): McpTool {
  return {
    name: direction,
    description:
      direction === 'undo'
        ? 'Reverts the last change (one tool call is one step). Fails when there is nothing to undo.'
        : 'Re-applies the change that was last undone. Fails when there is nothing to redo.',
    inputSchema: {
      type: 'object',
      properties: { sessionId: { type: 'string', description: 'sessionId of the open document' } },
      required: ['sessionId'],
      additionalProperties: false,
    },
    annotations: editAnnotations(direction === 'undo' ? 'Undo' : 'Redo'),
    async handler(args) {
      const parsed = parseArguments(historyArgs, args);
      if (!parsed.ok) return parsed.error;
      const found = await requireSession(store, parsed.value.sessionId);
      if (!found.ok) return found.error;
      const session = found.value;
      const before = nodeIdsOf(session.doc);
      const result = direction === 'undo' ? session.undo() : session.redo();
      if (!result.ok) return sessionFailure(result.error, { session });
      const after = nodeIdsOf(session.doc);
      return textResult(
        [
          `${direction === 'undo' ? 'Undid' : 'Redid'} the last change: ${before.size} -> ${after.size} nodes.`,
          `${result.value.dirty ? 'Unsaved changes remain' : 'No unsaved changes'}${result.value.canUndo ? ', undo available' : ''}${result.value.canRedo ? ', redo available' : ''}.`,
        ].join('\n'),
        { ...sessionSummary(session), applied: true },
      );
    },
  };
}

/** The editing tools: each one atomic `executeBatch` on the session's working copy. */
export function createEditingTools(options: ToolFactoryOptions): McpTool[] {
  return [
    insertNodes(options),
    updateNode(options),
    moveNodes(options),
    removeNodes(options),
    duplicateNodes(options),
    wrapNodes(options),
    unwrapNode(options),
    applyCommands(options),
    historyTool(options, 'undo'),
    historyTool(options, 'redo'),
  ];
}
