import { z } from 'zod';
import type { NodeId } from '../../document/types.ts';
import { err, ok, type Result } from '../../result/result.ts';
import { canEdit } from '../../rules/can-edit.ts';
import { reason } from '../../rules/reasons.ts';
import { parseStyleValue } from '../../styles/grammar.ts';
import {
  BOX_SIDES,
  CORNERS,
  getStyleProperty,
  STYLE_GROUPS,
  type StylePropertyDef,
} from '../../styles/properties.ts';
import { MAX_STYLE_BREAKPOINTS } from '../../styles/schema.ts';
import { type CommandError, commandError, fromReason } from '../errors.ts';
import type { Command, CommandHandler, HandlerEnv } from '../types.ts';

/** Which layer of a node's styles a command edits: desktop (`{}`), a breakpoint, or a pseudo-state. */
export interface StyleLayer {
  readonly bp?: string | undefined;
  readonly state?: 'hover' | 'focus-visible' | 'active' | undefined;
}

export interface SetStylePayload {
  readonly id: NodeId;
  readonly layer: StyleLayer;
  readonly group: string;
  readonly property: string;
  /** For a per-side (`spacing.margin`) or per-corner (`border.radius`) property: one side/corner. */
  readonly side?: string | undefined;
  /**
   * A string or number in the property's grammar (tokens are written `$space.4`); for a box or
   * corners property without `side`, an object per side/corner that replaces the whole property.
   */
  readonly value: string | number | boolean | Readonly<Record<string, string | number>>;
}

export interface UnsetStylePayload {
  readonly id: NodeId;
  readonly layer: StyleLayer;
  readonly group: string;
  readonly property: string;
  /** Omitted for a box/corners property: removes every side. */
  readonly side?: string | undefined;
}

export interface ResetStylesPayload {
  readonly id: NodeId;
  /** Omitted: every layer of the node. */
  readonly layer?: StyleLayer | undefined;
}

export type SetStyleCommand = Command<'node.setStyle', SetStylePayload>;
export type UnsetStyleCommand = Command<'node.unsetStyle', UnsetStylePayload>;
export type ResetStylesCommand = Command<'node.resetStyles', ResetStylesPayload>;

const nodeId = z.string().min(1).max(64);
const layerSchema = z.strictObject({
  bp: z
    .string()
    .regex(/^[a-z][a-z0-9-]{0,31}$/)
    .optional(),
  state: z.enum(['hover', 'focus-visible', 'active']).optional(),
});
const group = z.enum(STYLE_GROUPS);
const property = z.string().regex(/^[A-Za-z]{1,32}$/);
const side = z.string().regex(/^[A-Za-z]{1,16}$/);
const scalar = z.union([z.string(), z.number()]);

const setStyleSchema = z.strictObject({
  id: nodeId,
  layer: layerSchema,
  group,
  property,
  side: side.optional(),
  value: z.union([scalar, z.boolean(), z.record(z.string().max(16), scalar)]),
});

const unsetStyleSchema = z.strictObject({
  id: nodeId,
  layer: layerSchema,
  group,
  property,
  side: side.optional(),
});

const resetStylesSchema = z.strictObject({ id: nodeId, layer: layerSchema.optional() });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const layerName = (layer: StyleLayer): string =>
  layer.state !== undefined ? `state:${layer.state}` : (layer.bp ?? 'base');

/** The sides (`top`...) or corners (`topLeft`...) a shaped property accepts. */
const partsOf = (def: StylePropertyDef): readonly string[] =>
  def.shape === 'box' ? BOX_SIDES : def.shape === 'corners' ? CORNERS : [];

/** Node + style lock; the layer must be one node styles can hold. */
function checkTarget(
  doc: Parameters<CommandHandler['validate']>[0],
  env: HandlerEnv,
  id: NodeId,
  layer: StyleLayer | undefined,
): Result<void, CommandError> {
  if (!Object.hasOwn(doc.nodes, id)) {
    return err(
      fromReason(reason('node-not-found', `Node "${id}" does not exist.`, { nodeId: id })),
    );
  }
  const editable = canEdit(doc, env.index, id, 'style');
  if (!editable.ok) return err(fromReason(editable.error));
  if (layer?.bp !== undefined && layer.state !== undefined) {
    return err(
      commandError('command.invalid-layer', 'A layer is a breakpoint or a pseudo-state, not both.'),
    );
  }
  if (layer?.bp === 'base') {
    return err(commandError('command.invalid-layer', '"base" is the desktop layer: omit `bp`.'));
  }
  return ok(undefined);
}

function checkProperty(
  layer: StyleLayer,
  groupName: string,
  name: string,
  part: string | undefined,
): Result<StylePropertyDef, CommandError> {
  const def = getStyleProperty(groupName, name);
  if (def === undefined) {
    return err(
      commandError(
        'command.unknown-style-property',
        `Unknown style property "${groupName}.${name}".`,
      ),
    );
  }
  if (layer.state !== undefined && !def.allowInStates) {
    return err(
      commandError(
        'command.not-allowed-in-state',
        `"${groupName}.${name}" cannot be set in a pseudo-state.`,
      ),
    );
  }
  if (part !== undefined) {
    if (def.shape === 'value') {
      return err(
        commandError('command.invalid-side', `"${groupName}.${name}" has no sides or corners.`),
      );
    }
    if (!partsOf(def).includes(part)) {
      return err(
        commandError('command.invalid-side', `"${part}" is not a valid side for "${name}".`),
      );
    }
  }
  return ok(def);
}

function checkValue(
  def: StylePropertyDef,
  value: unknown,
  what: string,
): Result<void, CommandError> {
  const parsed = parseStyleValue(def.grammar, value, { inheritable: def.inheritable });
  return parsed.ok
    ? ok(undefined)
    : err(commandError('command.invalid-value', `${what}: ${parsed.error.message}`));
}

/** Removes empty objects bottom-up; returns whether `value` itself ended up empty. */
function prune(value: Record<string, unknown>): boolean {
  for (const key of Object.keys(value)) {
    const child = value[key];
    if (isRecord(child) && prune(child)) delete value[key];
  }
  return Object.keys(value).length === 0;
}

/** Finds the `StyleDecl` of `layer` in a node's styles, creating the path when `create` is set. */
function declOf(
  styles: Record<string, unknown>,
  layer: StyleLayer,
  create: boolean,
): Record<string, unknown> | undefined {
  const [container, key] =
    layer.state !== undefined
      ? (['state', layer.state] as const)
      : layer.bp !== undefined
        ? (['bp', layer.bp] as const)
        : ([undefined, 'base'] as const);
  let holder = styles;
  if (container !== undefined) {
    let inner = styles[container];
    if (!isRecord(inner)) {
      if (!create) return undefined;
      inner = {};
      styles[container] = inner;
    }
    holder = inner as Record<string, unknown>;
  }
  let decl = Object.hasOwn(holder, key) ? holder[key] : undefined;
  if (!isRecord(decl)) {
    if (!create) return undefined;
    decl = {};
    holder[key] = decl;
  }
  return decl as Record<string, unknown>;
}

const styleMergeKey = (
  cmd: Command<
    string,
    { id: NodeId; layer: StyleLayer; group: string; property: string; side?: string | undefined }
  >,
): string => {
  const { id, layer, group: g, property: prop, side: part } = cmd.payload;
  return `setStyle:${id}:${g}.${prop}${part !== undefined ? `.${part}` : ''}:${layerName(layer)}`;
};

/**
 * `node.setStyle` — sets one style property of a node on one layer (desktop, a breakpoint, or a
 * pseudo-state; docs/commands.md, docs/styles.md). The value goes through the property's grammar
 * (`parseStyleValue`), so nothing outside it can be stored; it is stored as written (tokens stay
 * `$space.4`). Pseudo-states only accept visual properties. Style locks apply. Coalesces by
 * `setStyle:<id>:<group>.<property>[.<side>]:<layer>`.
 */
export const setStyleHandler: CommandHandler<SetStyleCommand> = {
  type: 'node.setStyle',
  schema: setStyleSchema,
  mergeKey: styleMergeKey,

  validate(doc, cmd, env) {
    const { id, layer, group: groupName, property: name, side: part, value } = cmd.payload;
    const target = checkTarget(doc, env, id, layer);
    if (!target.ok) return target;
    const def = checkProperty(layer, groupName, name, part);
    if (!def.ok) return def;

    const bpCount = Object.keys(doc.nodes[id]?.styles?.bp ?? {}).length;
    if (
      layer.bp !== undefined &&
      bpCount >= MAX_STYLE_BREAKPOINTS &&
      doc.nodes[id]?.styles?.bp?.[layer.bp] === undefined
    ) {
      return err(
        commandError(
          'command.limit-exceeded',
          `A node has styles for at most ${MAX_STYLE_BREAKPOINTS} breakpoints.`,
        ),
      );
    }

    if (isRecord(value)) {
      if (def.value.shape === 'value' || part !== undefined) {
        return err(
          commandError(
            'command.invalid-value',
            'An object value needs a per-side or per-corner property.',
          ),
        );
      }
      const entries = Object.entries(value);
      if (entries.length === 0) {
        return err(
          commandError('command.invalid-value', 'An object value needs at least one side.'),
        );
      }
      for (const [key, part_] of entries) {
        if (!partsOf(def.value).includes(key)) {
          return err(
            commandError('command.invalid-side', `"${key}" is not a valid side for "${name}".`),
          );
        }
        const checked = checkValue(def.value, part_, key);
        if (!checked.ok) return checked;
      }
      return ok(undefined);
    }
    if (def.value.shape !== 'value' && part === undefined) {
      return err(
        commandError(
          'command.invalid-value',
          `"${groupName}.${name}" is set per side or corner: pass \`side\`, or an object.`,
        ),
      );
    }
    return checkValue(def.value, value, 'the value');
  },

  apply(draft, cmd) {
    const { id, layer, group: groupName, property: name, side: part, value } = cmd.payload;
    const node = draft.nodes[id];
    if (node === undefined) return { affected: [] };
    const styles = (node.styles ?? {}) as Record<string, unknown>;
    const decl = declOf(styles, layer, true);
    if (decl === undefined) return { affected: [] };

    let groupObject = decl[groupName];
    if (!isRecord(groupObject)) {
      groupObject = {};
      decl[groupName] = groupObject;
    }
    const groupRecord = groupObject as Record<string, unknown>;
    if (part === undefined) {
      groupRecord[name] = isRecord(value) ? { ...value } : value;
    } else {
      let sides = groupRecord[name];
      if (!isRecord(sides)) {
        sides = {};
        groupRecord[name] = sides;
      }
      (sides as Record<string, unknown>)[part] = value;
    }
    node.styles = styles as never;
    return { affected: [id] };
  },
};

/**
 * `node.unsetStyle` — removes one property (or one side/corner) from a layer, so the layer falls
 * back to the wider one or the component's own CSS. Empty objects left behind are removed;
 * removing something absent changes nothing.
 */
export const unsetStyleHandler: CommandHandler<UnsetStyleCommand> = {
  type: 'node.unsetStyle',
  schema: unsetStyleSchema,
  mergeKey: styleMergeKey,

  validate(doc, cmd, env) {
    const { id, layer, group: groupName, property: name, side: part } = cmd.payload;
    const target = checkTarget(doc, env, id, layer);
    if (!target.ok) return target;
    const def = checkProperty(layer, groupName, name, part);
    return def.ok ? ok(undefined) : def;
  },

  apply(draft, cmd) {
    const { id, layer, group: groupName, property: name, side: part } = cmd.payload;
    const node = draft.nodes[id];
    const styles = node?.styles as Record<string, unknown> | undefined;
    if (node === undefined || styles === undefined) return { affected: [] };
    const decl = declOf(styles, layer, false);
    const groupObject = decl?.[groupName];
    if (!isRecord(groupObject) || !Object.hasOwn(groupObject, name)) return { affected: [] };

    if (part === undefined) {
      delete groupObject[name];
    } else {
      const sides = groupObject[name];
      if (!isRecord(sides) || !Object.hasOwn(sides, part)) return { affected: [] };
      delete sides[part];
    }
    if (prune(styles)) delete node.styles;
    return { affected: [id] };
  },
};

/**
 * `node.resetStyles` — clears every override on one layer, or on all layers when `layer` is
 * omitted, leaving no empty objects behind. Resetting nothing changes nothing.
 */
export const resetStylesHandler: CommandHandler<ResetStylesCommand> = {
  type: 'node.resetStyles',
  schema: resetStylesSchema,
  mergeKey: () => undefined,

  validate(doc, cmd, env) {
    return checkTarget(doc, env, cmd.payload.id, cmd.payload.layer);
  },

  apply(draft, cmd) {
    const { id, layer } = cmd.payload;
    const node = draft.nodes[id];
    const styles = node?.styles as Record<string, unknown> | undefined;
    if (node === undefined || styles === undefined) return { affected: [] };

    if (layer === undefined) {
      delete node.styles;
      return { affected: [id] };
    }
    const decl = declOf(styles, layer, false);
    if (decl === undefined) return { affected: [] };
    for (const key of Object.keys(decl)) delete decl[key];
    if (prune(styles)) delete node.styles;
    return { affected: [id] };
  },
};
