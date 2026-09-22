import {
  type BuilderDocument,
  type ComponentType,
  createSeededIdGenerator,
  type IdGenerator,
  type NodeId,
  type PageNode,
  ROOT_COMPONENT_TYPE,
  type SlotName,
} from '@buildr/core';

const DEFAULT_NODE_TYPE: ComponentType = 'buildr/text';

/** Options for `node()` — a flat `PageNode`, `slots` referencing already-minted IDs directly. */
export interface NodeOptions {
  readonly id?: NodeId;
  readonly type?: ComponentType;
  readonly props?: PageNode['props'];
  readonly slots?: Readonly<Record<SlotName, readonly NodeId[]>>;
  readonly styles?: PageNode['styles'];
  readonly name?: PageNode['name'];
  readonly anchor?: PageNode['anchor'];
  readonly visibleIf?: PageNode['visibleIf'];
  readonly lock?: PageNode['lock'];
  readonly region?: PageNode['region'];
  readonly source?: PageNode['source'];
  readonly ext?: PageNode['ext'];
}

/**
 * Builds one `PageNode`, defaulting `id` (via `generateId` unless `idGen` is passed) and `type`.
 * For splicing an ad hoc node directly into a hand-built `doc.nodes` map — see
 * `fixtures/documents` for corrupted-document examples that do exactly this.
 */
export function node(options: NodeOptions = {}, idGen: IdGenerator = defaultIdGen): PageNode {
  const id = options.id ?? idGen();
  const type = options.type ?? DEFAULT_NODE_TYPE;
  return {
    id,
    type,
    ...(options.props !== undefined ? { props: options.props } : {}),
    ...(options.slots !== undefined ? { slots: options.slots } : {}),
    ...(options.styles !== undefined ? { styles: options.styles } : {}),
    ...(options.name !== undefined ? { name: options.name } : {}),
    ...(options.anchor !== undefined ? { anchor: options.anchor } : {}),
    ...(options.visibleIf !== undefined ? { visibleIf: options.visibleIf } : {}),
    ...(options.lock !== undefined ? { lock: options.lock } : {}),
    ...(options.region !== undefined ? { region: options.region } : {}),
    ...(options.source !== undefined ? { source: options.source } : {}),
    ...(options.ext !== undefined ? { ext: options.ext } : {}),
  };
}

/** The nested authoring shape `doc()` accepts — `children` is sugar for `slots.default`. */
export interface NodeTree {
  readonly id?: NodeId;
  readonly type?: ComponentType;
  readonly props?: PageNode['props'];
  readonly children?: readonly NodeTree[];
  readonly slots?: Readonly<Record<SlotName, readonly NodeTree[]>>;
  readonly styles?: PageNode['styles'];
  readonly name?: PageNode['name'];
  readonly anchor?: PageNode['anchor'];
  readonly visibleIf?: PageNode['visibleIf'];
  readonly lock?: PageNode['lock'];
  readonly region?: PageNode['region'];
  readonly source?: PageNode['source'];
  readonly ext?: PageNode['ext'];
}

export interface DocOptions {
  /** Defaults to a fresh seeded generator so a document built without one is still deterministic. */
  readonly idGen?: IdGenerator;
  /** Extra entries merged into the derived `components` version map (default version 1 each). */
  readonly components?: Readonly<Record<ComponentType, number>>;
  readonly meta?: BuilderDocument['meta'];
}

/**
 * Builds a full `BuilderDocument` from a nested `NodeTree` rooted at the document root (type
 * fixed to `ROOT_COMPONENT_TYPE`, id fixed to `"root"` — see docs/document-model.md). IDs are
 * minted via `idGen` for any node that doesn't pin its own `id`; every component type
 * encountered is added to `components` at version 1 unless overridden.
 */
export function doc(root: NodeTree = {}, options: DocOptions = {}): BuilderDocument {
  const idGen = options.idGen ?? createSeededIdGenerator('test-utils/doc');
  const nodes: Record<NodeId, PageNode> = {};
  const components: Record<ComponentType, number> = { ...options.components };

  function register(type: ComponentType): void {
    if (!(type in components)) components[type] = 1;
  }

  function build(id: NodeId, tree: NodeTree): PageNode {
    const type = tree.type ?? DEFAULT_NODE_TYPE;
    register(type);

    const slotsSpec = tree.slots ?? (tree.children ? { default: tree.children } : undefined);
    const slots: Record<SlotName, NodeId[]> | undefined = slotsSpec
      ? Object.fromEntries(
          Object.entries(slotsSpec).map(([slotName, children]) => [
            slotName,
            children.map((child) => {
              const childId = child.id ?? idGen();
              nodes[childId] = build(childId, child);
              return childId;
            }),
          ]),
        )
      : undefined;

    return node(
      {
        id,
        type,
        ...(tree.props !== undefined ? { props: tree.props } : {}),
        ...(slots !== undefined ? { slots } : {}),
        ...(tree.styles !== undefined ? { styles: tree.styles } : {}),
        ...(tree.name !== undefined ? { name: tree.name } : {}),
        ...(tree.anchor !== undefined ? { anchor: tree.anchor } : {}),
        ...(tree.visibleIf !== undefined ? { visibleIf: tree.visibleIf } : {}),
        ...(tree.lock !== undefined ? { lock: tree.lock } : {}),
        ...(tree.region !== undefined ? { region: tree.region } : {}),
        ...(tree.source !== undefined ? { source: tree.source } : {}),
        ...(tree.ext !== undefined ? { ext: tree.ext } : {}),
      },
      idGen,
    );
  }

  register(ROOT_COMPONENT_TYPE);
  const rootNode = build('root', { ...root, type: ROOT_COMPONENT_TYPE });

  return {
    schemaVersion: 1,
    root: 'root',
    nodes: { ...nodes, root: rootNode },
    components,
    ...(options.meta !== undefined ? { meta: options.meta } : {}),
  };
}

// `node()`'s default when the caller doesn't pass its own `idGen` — seeded, not `generateId`, so
// a fixture built without one is still deterministic (see docs/ai/testing-rules.md).
const defaultIdGen = createSeededIdGenerator('test-utils/node');
