import { walk } from '../document/traverse.ts';
import type { BuilderDocument, ComponentType, NodeId, PageNode } from '../document/types.ts';
import type { Diagnostic } from '../result/diagnostic.ts';

/**
 * Read-only view of one node's own subtree — itself plus its descendants, never the whole
 * document (see ADR-014, docs/migrations.md#component-migrations). Keeps a component migration
 * composable: it can inspect its own children for a structural migration without reaching outside
 * its subtree. `subtree` is computed lazily so a migration that only touches `props` never pays
 * for the walk.
 */
export interface ComponentMigrationContext {
  readonly nodeId: NodeId;
  readonly subtree: ReadonlyMap<NodeId, PageNode>;
}

/** One forward-only prop-schema hop for a single component type (docs/migrations.md). */
export interface ComponentMigrationStep {
  readonly from: number;
  readonly to: number;
  readonly migrate: (props: PageNode['props'], ctx: ComponentMigrationContext) => PageNode['props'];
}

/**
 * What the running registry currently knows about one component type (PB-015): the prop-schema
 * version its `ComponentMeta.version` declares, and the ordered steps needed to reach it from any
 * older version stored in a document (the non-serializable half of `defineComponent`'s
 * `migrations`, PB-044). A type with no migrations yet still needs an entry — `steps: []` — so
 * `migrateComponents` can tell "known, already current" apart from "unknown to this registry".
 */
export interface ComponentMigrationEntry {
  readonly currentVersion: number;
  readonly steps: readonly ComponentMigrationStep[];
}

export type ComponentMigrations = Readonly<Record<ComponentType, ComponentMigrationEntry>>;

export interface MigrateComponentsResult {
  readonly doc: BuilderDocument;
  /** Steps actually applied, keyed by type — a type left untouched has no entry here. */
  readonly applied: Readonly<Record<ComponentType, readonly ComponentMigrationStep[]>>;
  /**
   * Why a type couldn't be brought up to its current version (stored newer than the registry
   * knows, or an invalid step chain) — the document should be treated as read-only in the editor
   * while this is non-empty, rather than silently downgraded or corrupted (ADR-014).
   */
  readonly readOnlyReasons: readonly Diagnostic[];
  /** A `doc.components` type absent from `migrations` — left untouched, not a read-only reason. */
  readonly diagnostics: readonly Diagnostic[];
}

type ChainResolution =
  | { readonly ok: true; readonly steps: readonly ComponentMigrationStep[] }
  | { readonly ok: false; readonly reason: Diagnostic };

/**
 * Resolves the ordered step chain from `fromVersion` to `toVersion` for one type — version
 * bookkeeping only, no node touched. Mirrors `runMigrationChain`'s validation (no gaps, every hop
 * moves forward, the chain doesn't overshoot) but can't reuse it directly: a component step's
 * `migrate` takes a per-node `ComponentMigrationContext` as a second argument, which
 * `MigrationStep<T>`'s `(input: T) => T` shape has no room for.
 */
function resolveChain(
  type: ComponentType,
  steps: readonly ComponentMigrationStep[],
  fromVersion: number,
  toVersion: number,
): ChainResolution {
  if (fromVersion > toVersion) {
    return {
      ok: false,
      reason: {
        code: 'component.newer-than-registry',
        message: `"${type}" is stored at version ${fromVersion}, newer than the ${toVersion} this registry knows`,
        severity: 'warning',
        details: { type, storedVersion: fromVersion, registryVersion: toVersion },
      },
    };
  }

  const applied: ComponentMigrationStep[] = [];
  let version = fromVersion;
  while (version < toVersion) {
    const step = steps.find((candidate) => candidate.from === version);
    if (!step) {
      return {
        ok: false,
        reason: {
          code: 'component.migration-chain-invalid',
          message: `"${type}" has no migration step starting at version ${version} (target: ${toVersion})`,
          severity: 'warning',
          details: { type, from: version, to: toVersion },
        },
      };
    }
    if (step.to <= version) {
      return {
        ok: false,
        reason: {
          code: 'component.migration-chain-invalid',
          message: `"${type}"'s migration step from ${step.from} to ${step.to} does not move forward`,
          severity: 'warning',
          details: { type, from: step.from, to: step.to },
        },
      };
    }
    applied.push(step);
    version = step.to;
  }

  if (version > toVersion) {
    return {
      ok: false,
      reason: {
        code: 'component.migration-chain-invalid',
        message: `"${type}"'s migration steps land on version ${version}, past the target version ${toVersion}`,
        severity: 'warning',
        details: { type, landedOn: version, target: toVersion },
      },
    };
  }

  return { ok: true, steps: applied };
}

function buildContext(doc: BuilderDocument, nodeId: NodeId): ComponentMigrationContext {
  let cached: ReadonlyMap<NodeId, PageNode> | undefined;
  return {
    nodeId,
    get subtree() {
      cached ??= new Map([...walk(doc, nodeId)].map((node) => [node.id, node]));
      return cached;
    },
  };
}

/** Returns `node` with `props` replaced, omitting the key entirely when a migration clears it. */
function withProps(node: PageNode, props: PageNode['props']): PageNode {
  if (props !== undefined) return { ...node, props };
  const { props: _omit, ...rest } = node;
  return rest;
}

/**
 * Migrates every node's props forward to what `migrations` (built from the running registry,
 * PB-015) currently knows for its type, and updates `doc.components` to match (see ADR-014,
 * docs/migrations.md#component-migrations). Driven entirely by `doc.components`:
 *
 * - A type absent from `migrations` is unknown to this registry — its nodes are left untouched
 *   and reported via `diagnostics` (`component.unknown-type`).
 * - A type already at `migrations[type].currentVersion` is left untouched (nothing to do).
 * - A type whose stored version is newer than the registry knows, or whose step chain can't
 *   reach `currentVersion`, is left untouched and reported via `readOnlyReasons`.
 * - Otherwise every node of that type has its `props` folded through the resolved step chain,
 *   each step scoped to that node's own subtree (never the rest of the document), and
 *   `doc.components[type]` is bumped to `currentVersion`.
 *
 * Never mutates `doc`; returns it unchanged (the same reference) when nothing needs migrating.
 */
export function migrateComponents(
  doc: BuilderDocument,
  migrations: ComponentMigrations,
): MigrateComponentsResult {
  const nodesByType = new Map<ComponentType, PageNode[]>();
  for (const node of Object.values(doc.nodes)) {
    const list = nodesByType.get(node.type);
    if (list) list.push(node);
    else nodesByType.set(node.type, [node]);
  }

  const applied: Record<ComponentType, readonly ComponentMigrationStep[]> = {};
  const readOnlyReasons: Diagnostic[] = [];
  const diagnostics: Diagnostic[] = [];
  let nodes: Record<NodeId, PageNode> | undefined;
  let components: Record<ComponentType, number> | undefined;

  for (const [type, storedVersion] of Object.entries(doc.components)) {
    const entry = migrations[type];
    if (!entry) {
      diagnostics.push({
        code: 'component.unknown-type',
        message: `"${type}" is not a known component type; its nodes were left untouched`,
        severity: 'warning',
        details: { type, storedVersion },
      });
      continue;
    }

    if (entry.currentVersion === storedVersion) continue;

    const chain = resolveChain(type, entry.steps, storedVersion, entry.currentVersion);
    if (!chain.ok) {
      readOnlyReasons.push(chain.reason);
      continue;
    }

    applied[type] = chain.steps;
    components ??= { ...doc.components };
    components[type] = entry.currentVersion;

    for (const node of nodesByType.get(type) ?? []) {
      const ctx = buildContext(doc, node.id);
      let props = node.props;
      for (const step of chain.steps) props = step.migrate(props, ctx);

      nodes ??= { ...doc.nodes };
      nodes[node.id] = withProps(node, props);
    }
  }

  if (!nodes && !components) return { doc, applied, readOnlyReasons, diagnostics };

  return {
    doc: {
      ...doc,
      ...(nodes ? { nodes } : {}),
      ...(components ? { components } : {}),
    },
    applied,
    readOnlyReasons,
    diagnostics,
  };
}
