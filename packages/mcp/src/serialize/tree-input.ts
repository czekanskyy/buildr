import type { PropDef, RegistryMeta, Result, TreeNode, Value } from '@buildr/core';
import {
  ANCHOR_PATTERN,
  compileExpression,
  compileTemplate,
  err,
  nodeStylesSchema,
  ok,
  parsePath,
  validatePropValue,
  valueSchema,
} from '@buildr/core';
import { z } from 'zod';
import { allowedChildTypes, allowedParents } from './structure.ts';
import { list, nearest, suggest } from './text.ts';

/** The most nodes one tree may hold; a guard against runaway agent output. */
export const MAX_TREE_NODES = 500;
/** The deepest nesting of one tree. */
export const MAX_TREE_DEPTH = 24;
const MAX_ISSUES = 20;

/**
 * What an agent writes for `insert_nodes`: a nested `{ type, props, slots | children }` tree. A
 * prop value is either a plain JSON value (shorthand for a static value) or a full `Value`
 * (`{ kind: 'static' | 'binding' | 'expression', ... }`).
 */
export interface TreeInput {
  readonly type: string;
  readonly props?: Readonly<Record<string, unknown>> | undefined;
  readonly styles?: Readonly<Record<string, unknown>> | undefined;
  readonly children?: readonly TreeInput[] | undefined;
  readonly slots?: Readonly<Record<string, readonly TreeInput[]>> | undefined;
  readonly name?: string | undefined;
  readonly anchor?: string | undefined;
}

const TYPE_HELP =
  'Component type as "<namespace>/<name>", for example "buildr/heading". Use list_components for the valid types.';
const PROPS_HELP =
  'Props by name. A plain JSON value is a static value ({"text": "Hello"}); use {"kind":"binding","path":"post.title"} to bind data or {"kind":"expression","expr":"..."} for a formula; {"kind":"static","value":"Hallo"} with "l10n":{"pl":"Cześć"} carries translations. Unset props use the component default.';
const STYLES_HELP =
  'Style overrides for this node: {"base": {"spacing": {"padding": {"top": "$space.4"}}}, "bp": {"mobile": {...}}, "state": {"hover": {...}}}. See get_style_reference for groups and properties.';
const CHILDREN_HELP =
  'Shorthand for slots.default: the ordered children of the default slot. Use either "children" or "slots".';
const SLOTS_HELP =
  'Children per named slot, for components with several slots. Each slot lists its ordered children.';

/**
 * The Zod schema of a tree, with `.describe()` texts on every field (they become the JSON
 * Schema descriptions in tool definitions). Structure only, plus the component types as an enum
 * when a registry is given; use `parseTreeInput` for the registry-aware checks and messages.
 */
export function createTreeInputSchema(registry?: RegistryMeta): z.ZodType<TreeInput> {
  const types = registry
    ? registry
        .list()
        .filter((meta) => meta.capabilities?.insertable !== false && !meta.capabilities?.root)
        .map((meta) => meta.type)
    : [];
  const typeSchema = (
    types.length > 0 ? z.enum(types as [string, ...string[]]) : z.string()
  ).describe(TYPE_HELP);
  const node: z.ZodType<TreeInput> = z.lazy(() =>
    z.strictObject({
      type: typeSchema,
      props: z.record(z.string(), z.unknown()).optional().describe(PROPS_HELP),
      styles: z.record(z.string(), z.unknown()).optional().describe(STYLES_HELP),
      children: z.array(node).optional().describe(CHILDREN_HELP),
      slots: z.record(z.string(), z.array(node)).optional().describe(SLOTS_HELP),
      name: z.string().max(120).optional().describe('Label shown in the editor layers panel.'),
      anchor: z
        .string()
        .regex(ANCHOR_PATTERN)
        .optional()
        .describe('HTML id, unique in the document (for in-page links).'),
    }),
  );
  return node.describe('A component and its children.');
}

/** A reference to the tree node schema; use it with `treeInputDefs` inside a larger tool schema. */
export const TREE_NODE_REF = { $ref: '#/$defs/TreeNode' } as const;

function convert(registry: RegistryMeta | undefined): Record<string, unknown> {
  const raw = z.toJSONSchema(createTreeInputSchema(registry), {
    target: 'draft-2020-12',
    unrepresentable: 'any',
    io: 'input',
  }) as { $defs?: Record<string, unknown> };
  const text = JSON.stringify(raw.$defs?.['__schema0']).replaceAll(
    '#/$defs/__schema0',
    '#/$defs/TreeNode',
  );
  return JSON.parse(text) as Record<string, unknown>;
}

/**
 * The `$defs` to put at the root of a tool `inputSchema` that refers to `TREE_NODE_REF`:
 * `{ type: 'object', properties: { tree: TREE_NODE_REF }, $defs: treeInputDefs(registry) }`.
 */
export function treeInputDefs(registry?: RegistryMeta): {
  readonly TreeNode: Record<string, unknown>;
} {
  return { TreeNode: convert(registry) };
}

/**
 * The tree schema as a self-contained JSON Schema (draft 2020-12): an object at the root (MCP
 * requires that) whose recursion goes through `$defs.TreeNode`. Every field has a description.
 */
export function treeInputJsonSchema(registry?: RegistryMeta): Record<string, unknown> {
  const node = convert(registry);
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    ...node,
    $defs: { TreeNode: node },
  };
}

/** One problem in a tree, located by `path` (`slots.default[1].props.text`). */
export interface TreeInputIssue {
  readonly path: string;
  readonly message: string;
  /** The valid alternatives when the problem is an unknown name. */
  readonly validOptions?: readonly string[];
}

export interface TreeInputError {
  readonly code: 'invalid-tree';
  /** Every issue, one sentence each, joined for display. */
  readonly message: string;
  readonly issues: readonly TreeInputIssue[];
}

function isValueObject(raw: unknown): raw is Record<string, unknown> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const kind = (raw as { kind?: unknown }).kind;
  return kind === 'static' || kind === 'binding' || kind === 'expression';
}

/** Validates one prop value against its definition; returns the `Value` to store or a message. */
function toValue(def: PropDef, raw: unknown): Result<Value, string> {
  if (!isValueObject(raw)) {
    const checked = validatePropValue(def, raw);
    return checked.ok ? ok({ kind: 'static', value: checked.value }) : err(checked.error.message);
  }
  const parsed = valueSchema(z.unknown()).safeParse(raw);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? 'not a valid value');
  }
  const value = parsed.data as Value;
  if (value.kind === 'static') {
    const checked = validatePropValue(def, value.value);
    if (!checked.ok) return err(checked.error.message);
    if (value.l10n !== undefined) {
      if (!def.localizable) return err('this prop cannot be translated (it is not localizable)');
      for (const [locale, translated] of Object.entries(value.l10n)) {
        const t = validatePropValue(def, translated);
        if (!t.ok) return err(`the "${locale}" translation: ${t.error.message}`);
      }
    }
    return ok(value);
  }
  if (def.bindable === false || def.accepts.length === 0) {
    return err('this prop cannot be bound to data or computed; give it a plain value');
  }
  if (value.kind === 'binding') {
    const path = parsePath(value.path);
    return path.ok ? ok(value) : err(`invalid binding path: ${path.error.message}`);
  }
  const compiled =
    value.mode === 'template' ? compileTemplate(value.expr) : compileExpression(value.expr);
  return compiled.ok ? ok(value) : err(`invalid expression: ${compiled.error.message}`);
}

function join(path: string, next: string): string {
  return path === '' ? next : next.startsWith('[') ? `${path}${next}` : `${path}.${next}`;
}

/**
 * Checks `input` against the registry and turns it into a core `TreeNode` (props as `Value`s),
 * ready for `fromTree`. Reports every problem at once; unknown components, props and slots come
 * back with the valid ones (and a "did you mean").
 */
export function parseTreeInput(
  registry: RegistryMeta,
  input: unknown,
): Result<TreeNode, TreeInputError> {
  const issues: TreeInputIssue[] = [];
  const structural = createTreeInputSchema().safeParse(input);
  if (!structural.success) {
    for (const issue of structural.error.issues.slice(0, MAX_ISSUES)) {
      issues.push({
        path: issue.path
          .map((p, i) => (typeof p === 'number' ? `[${p}]` : i === 0 ? String(p) : `.${String(p)}`))
          .join(''),
        message: issue.message,
      });
    }
    return err(failure(issues));
  }
  const allTypes = registry
    .list()
    .filter((meta) => meta.capabilities?.insertable !== false && !meta.capabilities?.root)
    .map((meta) => meta.type);
  let count = 0;

  const report = (path: string, message: string, validOptions?: readonly string[]): void => {
    if (issues.length < MAX_ISSUES) {
      issues.push({ path, message, ...(validOptions ? { validOptions } : {}) });
    }
  };

  const walk = (raw: TreeInput, path: string, depth: number): TreeNode | undefined => {
    count += 1;
    if (count > MAX_TREE_NODES) {
      if (count === MAX_TREE_NODES + 1) {
        report(path, `the tree has more than ${MAX_TREE_NODES} nodes; insert it in several calls`);
      }
      return undefined;
    }
    if (depth > MAX_TREE_DEPTH) {
      report(path, `the tree is nested deeper than ${MAX_TREE_DEPTH} levels`);
      return undefined;
    }
    const at = path === '' ? 'root' : path;
    const meta = registry.get(raw.type);
    if (!meta) {
      report(
        join(path, 'type'),
        `"${raw.type}" is not a component of this site. ${suggest(raw.type, allTypes, 'component types')}`,
        nearest(raw.type, allTypes).length > 0 ? nearest(raw.type, allTypes) : allTypes,
      );
      return undefined;
    }
    if (meta.capabilities?.root || (depth === 0 && meta.capabilities?.insertable === false)) {
      report(
        join(path, 'type'),
        meta.capabilities?.root
          ? `${meta.type} is the document root and cannot be inserted.`
          : `${meta.type} cannot be inserted on its own; include it as a child of ${list([
              ...new Set(allowedParents(registry, meta.type, false).map((p) => p.type)),
            ])}.`,
      );
      return undefined;
    }

    const props: Record<string, Value> = {};
    const propNames = Object.keys(meta.props);
    for (const [name, rawValue] of Object.entries(raw.props ?? {})) {
      const def = Object.hasOwn(meta.props, name) ? meta.props[name] : undefined;
      if (!def) {
        report(
          join(join(path, 'props'), name),
          `${meta.type} has no prop "${name}". ${suggest(name, propNames, 'props')}`,
          propNames,
        );
        continue;
      }
      const value = toValue(def, rawValue);
      if (value.ok) props[name] = value.value;
      else report(join(join(path, 'props'), name), `${meta.type}.${name}: ${value.error}.`);
    }

    let styles: TreeNode['styles'];
    if (raw.styles !== undefined) {
      const parsed = nodeStylesSchema.safeParse(raw.styles);
      if (parsed.success) styles = parsed.data;
      else {
        const first = parsed.error.issues[0];
        report(
          join(path, 'styles'),
          `invalid styles: ${first?.message ?? 'not valid'}${first && first.path.length > 0 ? ` (at ${first.path.join('.')})` : ''}.`,
        );
      }
    }

    const slotNames = Object.keys(meta.slots ?? {});
    let slotSpec: Record<string, readonly TreeInput[]> | undefined;
    if (raw.children !== undefined && raw.slots !== undefined) {
      report(at, 'use either "children" or "slots", not both.');
    } else if (raw.children !== undefined) {
      slotSpec = { default: raw.children };
    } else if (raw.slots !== undefined) {
      slotSpec = raw.slots;
    }
    const builtSlots: Record<string, TreeNode[]> = {};
    for (const [slotName, children] of Object.entries(slotSpec ?? {})) {
      const slotPath = raw.children !== undefined ? 'children' : join('slots', slotName);
      if (slotNames.length === 0) {
        if (children.length > 0) {
          report(join(path, slotPath), `${meta.type} is a leaf component and takes no children.`);
        }
        continue;
      }
      if (!Object.hasOwn(meta.slots ?? {}, slotName)) {
        report(
          join(path, slotPath),
          `${meta.type} has no slot "${slotName}". Its slots: ${list(slotNames)}.`,
          slotNames,
        );
        continue;
      }
      const slotDef = meta.slots?.[slotName];
      if (slotDef?.max !== undefined && children.length > slotDef.max) {
        report(
          join(path, slotPath),
          `slot "${slotName}" of ${meta.type} takes at most ${slotDef.max} child(ren), got ${children.length}.`,
        );
      }
      const allowed = allowedChildTypes(registry, meta.type, slotName, false);
      const built: TreeNode[] = [];
      children.forEach((child, i) => {
        const childPath = join(path, `${slotPath}[${i}]`);
        if (registry.has(child.type) && !allowed.includes(child.type)) {
          report(
            join(childPath, 'type'),
            `${child.type} cannot be placed in slot "${slotName}" of ${meta.type}. Allowed there: ${list(allowed, 20)}.`,
            allowed,
          );
        }
        const node = walk(child, childPath, depth + 1);
        if (node) built.push(node);
      });
      builtSlots[slotName] = built;
    }

    return {
      type: meta.type,
      ...(Object.keys(props).length > 0 ? { props } : {}),
      ...(styles !== undefined ? { styles } : {}),
      ...(Object.keys(builtSlots).length > 0 ? { slots: builtSlots } : {}),
      ...(raw.name !== undefined ? { name: raw.name } : {}),
      ...(raw.anchor !== undefined ? { anchor: raw.anchor } : {}),
    };
  };

  const tree = walk(structural.data, '', 0);
  if (issues.length > 0 || !tree) return err(failure(issues));
  return ok(tree);
}

function failure(issues: readonly TreeInputIssue[]): TreeInputError {
  const message = issues
    .map((issue) => `${issue.path === '' ? 'tree' : issue.path}: ${issue.message}`)
    .join('\n');
  return { code: 'invalid-tree', message, issues };
}
