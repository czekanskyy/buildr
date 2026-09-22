import type { JsonValue } from '../json/json-value.ts';

/** `root`, or a random 10-character base62 string minted by `generateId` (see docs/document-model.md). */
export type NodeId = string;

/** `<namespace>/<name>`, e.g. `buildr/heading`, `acme/pricing-table`. */
export type ComponentType = string;

/** A slot key on a node; `default` holds a node's ordinary children. */
export type SlotName = string;

/** The fixed component type of the document root (see docs/document-model.md#invariants). */
export const ROOT_COMPONENT_TYPE: ComponentType = 'buildr/page';

/**
 * The canonical, normalized document shape (see docs/document-model.md, ADR-002). Props and
 * styles are typed `unknown` here — the `Value` and `NodeStyles` shapes land in PB-013 and
 * PB-027 respectively.
 */
export interface BuilderDocument {
  readonly schemaVersion: 1;
  readonly root: 'root';
  readonly nodes: Readonly<Record<NodeId, PageNode>>;
  readonly components: Readonly<Record<ComponentType, number>>;
  readonly meta?: Readonly<{ readonly createdWith?: string; readonly updatedWith?: string }>;
}

export interface PageNode {
  readonly id: NodeId;
  readonly type: ComponentType;
  /** Only props declared in the component's schema; a missing key means "use the default". */
  readonly props?: Readonly<Record<string, unknown>>;
  /** Order = render order. */
  readonly slots?: Readonly<Record<SlotName, readonly NodeId[]>>;
  /** Instance overrides only (see docs/styles.md). */
  readonly styles?: unknown;
  /** Layers-panel label. */
  readonly name?: string;
  /** HTML `id` attribute, unique in the document. */
  readonly anchor?: string;
  readonly visibleIf?: unknown;
  readonly lock?: Readonly<{
    readonly structure?: true;
    readonly content?: true;
    readonly style?: true;
  }>;
  /** An editable region inside a structurally locked subtree. */
  readonly region?: string;
  /** Provenance from a template (composite). */
  readonly source?: Readonly<{ readonly template: string; readonly version: number }>;
  /** Plugin extensions, namespaced keys e.g. `"acme:foo"`. */
  readonly ext?: Readonly<Record<string, JsonValue>>;
}
