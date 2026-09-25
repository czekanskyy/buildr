import type {
  BuilderDocument,
  ComponentMeta,
  PageNode,
  PropDef,
  RegistryMeta,
  Result,
  TreeNode,
} from '@buildr/core';
import { canInsert, createIndex, err, ok } from '@buildr/core';
import { allowedChildTypes, allowedParents, expandMatchers } from './structure.ts';
import { list, nearest, suggest } from './text.ts';

/** A prop as an agent needs it: what it is, what it may be, and whether it can be bound. */
export interface PropDescription {
  readonly name: string;
  readonly kind: string;
  readonly label?: string;
  readonly group?: string;
  readonly default: unknown;
  readonly required: boolean;
  /** May hold a binding or an expression (a `Value` of kind `binding` / `expression`). */
  readonly bindable: boolean;
  /** May carry per-locale translations. */
  readonly localizable: boolean;
  /** `select`: the allowed values. */
  readonly options?: readonly (string | number)[];
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly maxLength?: number;
  /** `media` and `listSource`: what is accepted. */
  readonly accept?: readonly string[];
  /** `list`: the item kind. */
  readonly of?: PropDescription;
  /** `object`: the fields. */
  readonly fields?: Readonly<Record<string, PropDescription>>;
  /** Data types a binding to this prop may produce. */
  readonly bindsTo?: readonly string[];
}

export interface SlotDescription {
  readonly name: string;
  readonly label?: string;
  readonly min?: number;
  readonly max?: number;
  /** The component types allowed as direct children, or `'any'` when every insertable one is. */
  readonly allowedChildren: readonly string[] | 'any';
}

export interface ComponentPlacementStep {
  readonly type: string;
  /** The slot of this node that holds the next step (or, for the last step, the component). */
  readonly slot: string;
}

export interface ComponentDescription {
  readonly type: string;
  readonly version: number;
  readonly label: string;
  readonly description?: string;
  readonly category: string;
  readonly keywords?: readonly string[];
  readonly props: readonly PropDescription[];
  /** Absent for a leaf component (no children). */
  readonly slots?: readonly SlotDescription[];
  readonly parentRules?: {
    readonly allowedParents?: readonly string[];
    readonly deniedParents?: readonly string[];
    readonly requiresAncestor?: readonly string[];
  };
  /** The style groups the component offers (see `get_style_reference`). */
  readonly styleGroups: readonly string[];
  readonly a11y?: {
    readonly element: string;
    readonly role?: string;
    readonly landmark?: boolean;
    readonly requiresName?: boolean;
    readonly rules?: readonly string[];
  };
  readonly capabilities: {
    readonly insertable: boolean;
    readonly removable: boolean;
    readonly duplicable: boolean;
    readonly draggable: boolean;
    readonly rootOnly: boolean;
  };
  /** The prop driving inline text editing; the natural place for the component's main text. */
  readonly primaryProp?: string;
  /** Rules worth knowing, each one sentence. */
  readonly notes: readonly string[];
  /**
   * A minimal valid tree (`insert_nodes` input) built from the component's defaults. For a
   * component that cannot be inserted on its own, the smallest insertable tree containing it.
   */
  readonly example: TreeNode;
  /**
   * Where the example can be inserted, as a chain of nodes from the document root; the last
   * step's `slot` is the insertion slot. `null` for the document root component itself.
   */
  readonly placement: readonly ComponentPlacementStep[] | null;
}

export interface UnknownComponentError {
  readonly code: 'unknown-component-type';
  readonly message: string;
  readonly suggestions: readonly string[];
}

function describeProp(name: string, def: PropDef): PropDescription {
  const extra: {
    options?: readonly (string | number)[];
    min?: number;
    max?: number;
    step?: number;
    maxLength?: number;
    accept?: readonly string[];
    of?: PropDescription;
    fields?: Record<string, PropDescription>;
  } = {};
  switch (def.kind) {
    case 'select':
      extra.options = def.options;
      break;
    case 'number':
      if (def.min !== undefined) extra.min = def.min;
      if (def.max !== undefined) extra.max = def.max;
      if (def.step !== undefined) extra.step = def.step;
      break;
    case 'text':
    case 'textarea':
      if (def.maxLength !== undefined) extra.maxLength = def.maxLength;
      break;
    case 'media':
    case 'listSource':
      if (def.accept !== undefined) extra.accept = def.accept;
      break;
    case 'list':
      extra.of = describeProp('item', def.of as PropDef);
      if (def.min !== undefined) extra.min = def.min;
      if (def.max !== undefined) extra.max = def.max;
      break;
    case 'object':
      extra.fields = Object.fromEntries(
        Object.entries(def.fields).map(([key, field]) => [
          key,
          describeProp(key, field as PropDef),
        ]),
      );
      break;
    default:
      break;
  }
  const bindable = def.bindable !== false && def.accepts.length > 0;
  return {
    name,
    kind: def.kind,
    ...(def.label !== undefined ? { label: def.label } : {}),
    ...(def.group !== undefined ? { group: def.group } : {}),
    default: def.default,
    required: def.required === true,
    bindable,
    localizable: def.localizable,
    ...extra,
    ...(bindable ? { bindsTo: def.accepts } : {}),
  };
}

function isPlainInsertable(meta: ComponentMeta): boolean {
  return meta.capabilities?.insertable !== false && !meta.capabilities?.root;
}

function describeSlots(
  registry: RegistryMeta,
  meta: ComponentMeta,
): readonly SlotDescription[] | undefined {
  if (!meta.slots) return undefined;
  const placeable = registry.list().filter((m) => !m.capabilities?.root).length;
  return Object.entries(meta.slots).map(([name, def]) => {
    const allowed = allowedChildTypes(registry, meta.type, name, false);
    return {
      name,
      ...(def.label !== undefined ? { label: def.label } : {}),
      ...(def.min !== undefined ? { min: def.min } : {}),
      ...(def.max !== undefined ? { max: def.max } : {}),
      allowedChildren: allowed.length >= placeable ? ('any' as const) : allowed,
    };
  });
}

/** A synthetic chain document: `types[0]` is the root, each next node sits in `slots[i]` of the previous. */
function chainDocument(types: readonly string[], slots: readonly string[]): BuilderDocument {
  const nodes: Record<string, PageNode> = {};
  types.forEach((type, i) => {
    const id = i === 0 ? 'root' : `p${i}`;
    const childSlot = slots[i];
    nodes[id] = {
      id,
      type,
      ...(childSlot !== undefined ? { slots: { [childSlot]: [`p${i + 1}`] } } : {}),
    };
  });
  return {
    schemaVersion: 1,
    root: 'root',
    nodes,
    components: Object.fromEntries(types.map((type) => [type, 1])),
  };
}

const MAX_PLACEMENT_DEPTH = 4;

/**
 * The shortest chain of wrappers below the document root that lets `type` be inserted, judged
 * by `canInsert` itself; `null` when the component cannot be placed (or is the root).
 */
export function findPlacement(
  registry: RegistryMeta,
  type: string,
): readonly ComponentPlacementStep[] | null {
  const meta = registry.get(type);
  if (!meta || !isPlainInsertable(meta)) return null;
  const rootMeta = registry.list().find((m) => m.capabilities?.root);
  if (!rootMeta) return null;
  const wrappers = registry.list().filter((m) => isPlainInsertable(m) && m.slots !== undefined);

  const seen = new Set<string>([rootMeta.type]);
  let frontier: { types: string[]; slots: string[] }[] = [{ types: [rootMeta.type], slots: [] }];
  for (let depth = 0; depth < MAX_PLACEMENT_DEPTH && frontier.length > 0; depth++) {
    const next: typeof frontier = [];
    for (const { types, slots } of frontier) {
      const endType = types[types.length - 1] ?? rootMeta.type;
      const doc = chainDocument(types, slots);
      const index = createIndex(doc);
      for (const slot of Object.keys(registry.get(endType)?.slots ?? {})) {
        const target = { parentId: types.length === 1 ? 'root' : `p${types.length - 1}`, slot };
        if (canInsert(doc, index, registry, target, type).ok) {
          return types.map((t, i) => ({
            type: t,
            slot: i < types.length - 1 ? (slots[i] ?? slot) : slot,
          }));
        }
        for (const wrapper of wrappers) {
          if (seen.has(wrapper.type)) continue;
          if (canInsert(doc, index, registry, target, wrapper.type).ok) {
            seen.add(wrapper.type);
            next.push({ types: [...types, wrapper.type], slots: [...slots, slot] });
          }
        }
      }
    }
    frontier = next;
  }
  return null;
}

function defaultProps(meta: ComponentMeta): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  const inline = meta.editor?.inlineProp;
  for (const [name, def] of Object.entries(meta.props)) {
    const wanted = def.required === true || name === inline;
    if (!wanted) continue;
    const value = def.default;
    const empty = value === '' || value === undefined || value === null;
    props[name] = empty && name === inline ? (meta.editor?.placeholder ?? meta.label) : value;
  }
  return props;
}

function exampleFor(
  registry: RegistryMeta,
  meta: ComponentMeta,
  trail: readonly string[] = [],
): TreeNode {
  const props = defaultProps(meta);
  const slots: Record<string, readonly TreeNode[]> = {};
  const seeded = meta.defaults?.slots;
  for (const [name, def] of Object.entries(meta.slots ?? {})) {
    const fromDefaults = seeded?.[name];
    if (fromDefaults !== undefined && fromDefaults.length > 0) {
      slots[name] = fromDefaults;
      continue;
    }
    const min = def.min ?? 0;
    if (min <= 0 || trail.length >= 3) continue;
    const child = allowedChildTypes(registry, meta.type, name, false)
      .filter((childType) => !trail.includes(childType) && childType !== meta.type)
      .map((childType) => registry.get(childType))
      .find((candidate): candidate is ComponentMeta => candidate !== undefined);
    if (child) {
      slots[name] = Array.from({ length: min }, () =>
        exampleFor(registry, child, [...trail, meta.type]),
      );
    }
  }
  return {
    type: meta.type,
    ...(Object.keys(props).length > 0 ? { props: props as never } : {}),
    ...(Object.keys(slots).length > 0 ? { slots } : {}),
  };
}

/**
 * The example tree and where it goes. A component that cannot be inserted on its own (a list
 * item) gets the smallest insertable tree that contains it (a list with that item).
 */
function exampleAndPlacement(
  registry: RegistryMeta,
  meta: ComponentMeta,
): Pick<ComponentDescription, 'example' | 'placement'> {
  if (isPlainInsertable(meta)) {
    return { example: exampleFor(registry, meta), placement: findPlacement(registry, meta.type) };
  }
  if (!meta.capabilities?.root) {
    for (const parent of allowedParents(registry, meta.type, false)) {
      const parentMeta = registry.get(parent.type);
      if (!parentMeta || !isPlainInsertable(parentMeta)) continue;
      const base = exampleFor(registry, parentMeta);
      const example: TreeNode = {
        ...base,
        slots: { ...base.slots, [parent.slot]: [exampleFor(registry, meta)] },
      };
      return { example, placement: findPlacement(registry, parent.type) };
    }
  }
  return { example: exampleFor(registry, meta), placement: null };
}

function notesFor(registry: RegistryMeta, meta: ComponentMeta): string[] {
  const notes: string[] = [];
  if (meta.capabilities?.root)
    notes.push('This is the document root; it exists once and cannot be inserted.');
  if (meta.capabilities?.insertable === false && !meta.capabilities.root) {
    const parents = [...new Set(allowedParents(registry, meta.type, false).map((p) => p.type))];
    notes.push(
      `It cannot be inserted on its own; include it as a child inside a tree of ${list(parents)}.`,
    );
  }
  if (meta.capabilities?.removable === false) notes.push('It cannot be removed.');
  if (meta.capabilities?.draggable === false) notes.push('It cannot be moved.');
  if (meta.parents?.requireAncestor?.length) {
    notes.push(
      `It must be nested inside ${list(expandMatchers(registry, meta.parents.requireAncestor))}.`,
    );
  }
  if (meta.parents?.allow?.length) {
    notes.push(
      `It can only be placed directly inside ${list(expandMatchers(registry, meta.parents.allow))}.`,
    );
  }
  if (meta.parents?.deny?.length) {
    notes.push(
      `It cannot be placed directly inside ${list(expandMatchers(registry, meta.parents.deny))}.`,
    );
  }
  if (meta.a11y?.requiresName)
    notes.push('It needs an accessible name (text, label or aria-label).');
  if (meta.formField)
    notes.push('It is a form field: it must be inside a form and needs a unique name.');
  return notes;
}

/** Describes one component for an agent: props, slots, rules, and a minimal valid example. */
export function describeComponent(
  registry: RegistryMeta,
  type: string,
): Result<ComponentDescription, UnknownComponentError> {
  const meta = registry.get(type);
  if (!meta) {
    const suggestions = nearest(
      type,
      registry.list().map((m) => m.type),
    );
    return err({
      code: 'unknown-component-type',
      message: `"${type}" is not a component of this site. ${suggest(
        type,
        registry.list().map((m) => m.type),
        'component types',
      )}`,
      suggestions,
    });
  }
  const parents = meta.parents;
  const slots = describeSlots(registry, meta);
  const parentRules = parents
    ? {
        ...(parents.allow?.length
          ? { allowedParents: expandMatchers(registry, parents.allow) }
          : {}),
        ...(parents.deny?.length ? { deniedParents: expandMatchers(registry, parents.deny) } : {}),
        ...(parents.requireAncestor?.length
          ? { requiresAncestor: expandMatchers(registry, parents.requireAncestor) }
          : {}),
      }
    : undefined;
  return ok({
    type: meta.type,
    version: meta.version,
    label: meta.label,
    ...(meta.description !== undefined ? { description: meta.description } : {}),
    category: meta.category,
    ...(meta.keywords !== undefined ? { keywords: meta.keywords } : {}),
    props: Object.entries(meta.props).map(([name, def]) => describeProp(name, def)),
    ...(slots !== undefined ? { slots } : {}),
    ...(parentRules !== undefined && Object.keys(parentRules).length > 0 ? { parentRules } : {}),
    styleGroups: meta.styles.groups,
    ...(meta.a11y !== undefined ? { a11y: meta.a11y } : {}),
    capabilities: {
      insertable: meta.capabilities?.insertable !== false,
      removable: meta.capabilities?.removable !== false,
      duplicable: meta.capabilities?.duplicable !== false,
      draggable: meta.capabilities?.draggable !== false,
      rootOnly: meta.capabilities?.root === true,
    },
    ...(meta.editor?.inlineProp !== undefined ? { primaryProp: meta.editor.inlineProp } : {}),
    notes: notesFor(registry, meta),
    ...exampleAndPlacement(registry, meta),
  });
}

function propLine(prop: PropDescription): string {
  const flags = [
    prop.required ? 'required' : undefined,
    prop.bindable ? 'bindable' : undefined,
    prop.localizable ? 'localizable' : undefined,
  ].filter((flag) => flag !== undefined);
  const constraints: string[] = [];
  if (prop.options)
    constraints.push(`one of ${prop.options.map((o) => JSON.stringify(o)).join(' | ')}`);
  if (prop.min !== undefined) constraints.push(`min ${prop.min}`);
  if (prop.max !== undefined) constraints.push(`max ${prop.max}`);
  if (prop.maxLength !== undefined) constraints.push(`max length ${prop.maxLength}`);
  if (prop.accept) constraints.push(`accepts ${prop.accept.join(', ')}`);
  if (prop.of) constraints.push(`items: ${prop.of.kind}`);
  if (prop.fields) {
    constraints.push(
      `fields: ${Object.values(prop.fields)
        .map((f) => `${f.name}:${f.kind}`)
        .join(', ')}`,
    );
  }
  const parts = [
    `- ${prop.name} (${prop.kind}) default ${JSON.stringify(prop.default)}`,
    ...(constraints.length > 0 ? [constraints.join('; ')] : []),
    ...(flags.length > 0 ? [`[${flags.join(', ')}]`] : []),
  ];
  return parts.join(' ');
}

/** A compact text rendering of `describeComponent` for clients that read text. */
export function formatComponentDescription(description: ComponentDescription): string {
  const lines: string[] = [
    `${description.type} - ${description.label} (${description.category}, v${description.version})`,
  ];
  if (description.description) lines.push(description.description);
  lines.push(description.props.length > 0 ? 'Props:' : 'Props: none');
  for (const prop of description.props) lines.push(propLine(prop));
  if (description.slots) {
    lines.push('Slots:');
    for (const slot of description.slots) {
      const bounds = [
        slot.min !== undefined ? `min ${slot.min}` : undefined,
        slot.max !== undefined ? `max ${slot.max}` : undefined,
      ].filter((b) => b !== undefined);
      lines.push(
        `- ${slot.name}${bounds.length > 0 ? ` (${bounds.join(', ')})` : ''}: ${
          slot.allowedChildren === 'any' ? 'any component' : list(slot.allowedChildren, 30)
        }`,
      );
    }
  } else {
    lines.push('Slots: none (a leaf component, it takes no children)');
  }
  for (const note of description.notes) lines.push(`Note: ${note}`);
  lines.push(`Style groups: ${description.styleGroups.join(', ') || 'none'}`);
  if (description.a11y)
    lines.push(
      `Renders: ${description.a11y.element}${description.a11y.role ? ` (role ${description.a11y.role})` : ''}`,
    );
  if (description.placement) {
    lines.push(
      `Insert into: ${description.placement.map((step) => `${step.type}[${step.slot}]`).join(' > ')}`,
    );
  }
  lines.push(`Example: ${JSON.stringify(description.example)}`);
  return lines.join('\n');
}
