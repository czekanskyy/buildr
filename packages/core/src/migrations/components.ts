import type { BuilderFragment } from '../document/fragment.ts';
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
  /**
   * Retired component types this type replaces, keyed by the retired type. A node of a retired
   * type is rewritten into this type (see `ComponentReplacement`) and then continues through this
   * type's own steps from `toVersion`. Retired types need no entry of their own in the registry.
   */
  readonly replaces?: Readonly<Record<ComponentType, ComponentReplacement>>;
}

/** The part of a node a replacement rewrites; everything else on the node is preserved. */
export interface ComponentReplacementNode {
  readonly props: PageNode['props'];
  readonly styles: PageNode['styles'];
}

/**
 * One forward-only hop from a retired component type into the type that replaces it. Applies only
 * to nodes stored at exactly `fromVersion` of the retired type; the result is a node of the new
 * type at `toVersion`, which then folds through the new type's steps from there. Only `props` and
 * `styles` can change — id, slots and all other node fields are preserved by the runner.
 */
export interface ComponentReplacement {
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly migrate: (
    node: ComponentReplacementNode,
    ctx: ComponentMigrationContext,
  ) => ComponentReplacementNode;
}

export type ComponentMigrations = Readonly<Record<ComponentType, ComponentMigrationEntry>>;

export interface MigrateFragmentResult {
  readonly fragment: BuilderFragment;
  readonly readOnlyReasons: readonly Diagnostic[];
  readonly diagnostics: readonly Diagnostic[];
}

export interface MigrateComponentsResult {
  readonly doc: BuilderDocument;
  /**
   * Steps actually applied, keyed by type — a type left untouched has no entry here. For a retired
   * type this is the replacing type's steps its nodes folded through after the replacement.
   */
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

/** The slice of a document or fragment the migration core works on. */
interface NodeSet {
  readonly components: Readonly<Record<ComponentType, number>>;
  readonly nodes: Readonly<Record<NodeId, PageNode>>;
}

interface NodeSetResult {
  readonly nodes?: Record<NodeId, PageNode>;
  readonly components?: Record<ComponentType, number>;
  readonly applied: Record<ComponentType, readonly ComponentMigrationStep[]>;
  readonly readOnlyReasons: Diagnostic[];
  readonly diagnostics: Diagnostic[];
}

function buildContext(source: NodeSet, nodeId: NodeId): ComponentMigrationContext {
  let cached: ReadonlyMap<NodeId, PageNode> | undefined;
  return {
    nodeId,
    get subtree() {
      // `walk` only reads `root`, `nodes` and slots; the rest of the shape is irrelevant here.
      const view: BuilderDocument = {
        schemaVersion: 1,
        root: nodeId as BuilderDocument['root'],
        nodes: source.nodes,
        components: source.components,
      };
      cached ??= new Map([...walk(view, nodeId)].map((node) => [node.id, node]));
      return cached;
    },
  };
}

/** Returns `node` with the given fields replaced, omitting a key entirely when it is cleared. */
function withParts(
  node: PageNode,
  parts: { readonly props: PageNode['props']; readonly styles?: PageNode['styles'] },
  replaceStyles: boolean,
): PageNode {
  const { props: _props, styles: _styles, ...rest } = node;
  const next: { -readonly [K in keyof PageNode]: PageNode[K] } = { ...rest };
  if (parts.props !== undefined) next.props = parts.props;
  const styles = replaceStyles ? parts.styles : node.styles;
  if (styles !== undefined) next.styles = styles;
  return next;
}

function replacementIssue(
  retired: ComponentType,
  target: ComponentType,
  storedVersion: number,
  expected: number,
): Diagnostic {
  return {
    code: 'component.replacement-version-mismatch',
    message: `"${retired}" is stored at version ${storedVersion}, but its replacement "${target}" can only migrate it from version ${expected}`,
    severity: 'warning',
    details: { type: retired, replacedBy: target, storedVersion, expectedVersion: expected },
  };
}

function migrateNodeSet(source: NodeSet, migrations: ComponentMigrations): NodeSetResult {
  const { components: stored } = source;
  const nodesByType = new Map<ComponentType, PageNode[]>();
  for (const node of Object.values(source.nodes)) {
    const list = nodesByType.get(node.type);
    if (list) list.push(node);
    else nodesByType.set(node.type, [node]);
  }

  const retiredTypes = new Set<ComponentType>();
  for (const entry of Object.values(migrations)) {
    for (const retired of Object.keys(entry.replaces ?? {})) retiredTypes.add(retired);
  }

  const applied: Record<ComponentType, readonly ComponentMigrationStep[]> = {};
  const readOnlyReasons: Diagnostic[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const [type, storedVersion] of Object.entries(stored)) {
    if (migrations[type] || retiredTypes.has(type)) continue;
    diagnostics.push({
      code: 'component.unknown-type',
      message: `"${type}" is not a known component type; its nodes were left untouched`,
      severity: 'warning',
      details: { type, storedVersion },
    });
  }

  // Plan every group (a type plus the retired types it replaces) against the original input; a
  // group either applies in full or not at all.
  interface Plan {
    readonly target: ComponentType;
    readonly entry: ComponentMigrationEntry;
    readonly targetSteps: readonly ComponentMigrationStep[] | undefined;
    readonly retired: readonly {
      readonly type: ComponentType;
      readonly replacement: ComponentReplacement;
      readonly steps: readonly ComponentMigrationStep[];
    }[];
  }
  const plans: Plan[] = [];

  for (const [target, entry] of Object.entries(migrations)) {
    const targetStored = stored[target];
    const present = Object.entries(entry.replaces ?? {}).filter(
      ([retired]) => stored[retired] !== undefined || nodesByType.has(retired),
    );
    if (targetStored === undefined && present.length === 0) continue;

    const failures: Diagnostic[] = [];
    // Nodes of the replacing type but no stored version: nothing to migrate them from, and
    // stamping them current would hide stale props, so the group stays untouched.
    if (targetStored === undefined && nodesByType.has(target)) {
      failures.push({
        code: 'component.missing-version',
        message: `"${target}" has nodes but no stored version, so its group can't be migrated`,
        severity: 'warning',
        details: { type: target },
      });
    }
    let targetSteps: readonly ComponentMigrationStep[] | undefined;
    if (targetStored !== undefined && targetStored !== entry.currentVersion) {
      const chain = resolveChain(target, entry.steps, targetStored, entry.currentVersion);
      if (chain.ok) targetSteps = chain.steps;
      else failures.push(chain.reason);
    }

    const retired: Plan['retired'][number][] = [];
    for (const [type, replacement] of present) {
      const retiredStored = stored[type] ?? replacement.fromVersion;
      if (retiredStored !== replacement.fromVersion) {
        failures.push(replacementIssue(type, target, retiredStored, replacement.fromVersion));
        continue;
      }
      const chain = resolveChain(target, entry.steps, replacement.toVersion, entry.currentVersion);
      if (!chain.ok) {
        failures.push(chain.reason);
        continue;
      }
      retired.push({ type, replacement, steps: chain.steps });
    }

    if (failures.length > 0) {
      readOnlyReasons.push(...failures);
      continue;
    }
    if (!targetSteps && targetStored === entry.currentVersion && retired.length === 0) continue;
    plans.push({ target, entry, targetSteps, retired });
  }

  if (plans.length === 0) return { applied, readOnlyReasons, diagnostics };

  const nodes: Record<NodeId, PageNode> = { ...source.nodes };
  const components: Record<ComponentType, number> = { ...stored };

  for (const { target, entry, targetSteps, retired } of plans) {
    if (targetSteps) {
      applied[target] = targetSteps;
      for (const node of nodesByType.get(target) ?? []) {
        const ctx = buildContext(source, node.id);
        let props = node.props;
        for (const step of targetSteps) props = step.migrate(props, ctx);
        nodes[node.id] = withParts(node, { props }, false);
      }
    }

    for (const { type, replacement, steps } of retired) {
      applied[type] = steps;
      for (const node of nodesByType.get(type) ?? []) {
        const ctx = buildContext(source, node.id);
        const replaced = replacement.migrate({ props: node.props, styles: node.styles }, ctx);
        let props = replaced.props;
        for (const step of steps) props = step.migrate(props, ctx);
        nodes[node.id] = {
          ...withParts(node, { props, styles: replaced.styles }, true),
          type: target,
        };
      }
      delete components[type];
    }
    components[target] = entry.currentVersion;
  }

  return { nodes, components, applied, readOnlyReasons, diagnostics };
}

/**
 * Migrates every node's props forward to what `migrations` (built from the running registry,
 * PB-015) currently knows for its type, and updates `doc.components` to match (see ADR-014,
 * docs/migrations.md#component-migrations). Work is planned per migration group — a registered
 * type plus every retired type its entry `replaces` — against the original document, then applied;
 * every node starts from its original version and subtree.
 *
 * - A type absent from `migrations` and not retired by any entry is unknown to this registry —
 *   its nodes are left untouched and reported via `diagnostics` (`component.unknown-type`).
 * - A type already at `currentVersion` (and with no retired type to absorb) is left untouched.
 * - A type whose stored version is newer than the registry knows, or whose step chain can't
 *   reach `currentVersion`, is reported via `readOnlyReasons`, and so is a retired type stored at
 *   a version its replacement doesn't accept (`component.replacement-version-mismatch`), and so is
 *   a replacing type that has nodes but no stored version (`component.missing-version`). Any such
 *   failure leaves the whole group untouched (all of its nodes and versions).
 * - Otherwise every node of the type has its `props` folded through the resolved step chain, each
 *   step scoped to that node's own subtree. Nodes of a retired type are rewritten by the
 *   replacement (type, props, styles), then fold through the new type's steps from the
 *   replacement's `toVersion`, skipping the earlier ones. Retired types are looked up in
 *   `doc.nodes` too, since they may be missing from `doc.components` (a missing version counts as
 *   the replacement's `fromVersion`); they are dropped from `doc.components` afterwards.
 *
 * Never mutates `doc`; returns it unchanged (the same reference) when nothing needs migrating.
 */
export function migrateComponents(
  doc: BuilderDocument,
  migrations: ComponentMigrations,
): MigrateComponentsResult {
  const { nodes, components, applied, readOnlyReasons, diagnostics } = migrateNodeSet(
    doc,
    migrations,
  );
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

/**
 * `migrateComponents` for a fragment (clipboard, template insertion): the same planning and
 * application over `{ components, nodes }`, with `roots` carried through unchanged. Returns the
 * same fragment reference when nothing needs migrating.
 */
export function migrateFragment(
  fragment: BuilderFragment,
  migrations: ComponentMigrations,
): MigrateFragmentResult {
  const { nodes, components, readOnlyReasons, diagnostics } = migrateNodeSet(fragment, migrations);
  if (!nodes && !components) return { fragment, readOnlyReasons, diagnostics };
  return {
    fragment: {
      ...fragment,
      ...(nodes ? { nodes } : {}),
      ...(components ? { components } : {}),
    },
    readOnlyReasons,
    diagnostics,
  };
}
