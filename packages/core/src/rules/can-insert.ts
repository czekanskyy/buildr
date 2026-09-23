import type { DocumentIndex } from '../document/document-index.ts';
import type { BuilderFragment } from '../document/fragment.ts';
import { isAncestor } from '../document/traverse.ts';
import type { BuilderDocument, ComponentType, NodeId, SlotName } from '../document/types.ts';
import {
  type ContentCategory,
  categoryOf,
  isCategoryMatcher,
  type Matcher,
  matchesType,
} from '../registry/matchers.ts';
import type { RegistryMeta } from '../registry/registry.ts';
import { err, ok, type Result } from '../result/index.ts';
import { type ContentModelNode, checkGlobalContentModel } from './content-model.ts';
import { isLocked } from './locks.ts';
import { type Reason, reason } from './reasons.ts';

/** Where a node is being inserted: a parent, one of its slots, and a position within it. */
export interface InsertTarget {
  readonly parentId: NodeId;
  readonly slot: SlotName;
  /** Position within the slot's existing children; omitted appends at the end. */
  readonly at?: number;
}

/**
 * Whether `typeOrFragment` can be inserted at `target` — the single source of truth for
 * drag-and-drop, paste, insert, commands and document validation
 * (docs/component-registry.md#content-model-and-nesting-rules). Checks the target slot's
 * `allow`/`deny`, the inserted node's own `parents.allow`/`deny`/`requireAncestor`, the global
 * HTML content-model rules, `slot.max`, cycle prevention and structural locks/regions.
 */
export function canInsert(
  doc: BuilderDocument,
  index: DocumentIndex,
  registry: RegistryMeta,
  target: InsertTarget,
  typeOrFragment: ComponentType | BuilderFragment,
): Result<true, Reason> {
  return evaluateInsertion(doc, index, registry, target, typeOrFragment);
}

/**
 * `canInsert`'s full implementation, plus an `excludeFromSlotCount` escape hatch used by
 * `canMove`: when a node is being reordered within the slot it already occupies, it shouldn't
 * count against that slot's own `max` twice. Not part of the public `canInsert` signature
 * documented in docs/component-registry.md — `canMove` is the only other caller.
 */
export function evaluateInsertion(
  doc: BuilderDocument,
  index: DocumentIndex,
  registry: RegistryMeta,
  target: InsertTarget,
  typeOrFragment: ComponentType | BuilderFragment,
  excludeFromSlotCount?: NodeId,
): Result<true, Reason> {
  const parentNode = doc.nodes[target.parentId];
  if (!parentNode) {
    return err(
      reason('target-not-found', `Target parent "${target.parentId}" does not exist.`, {
        parentId: target.parentId,
      }),
    );
  }

  const parentMeta = registry.get(parentNode.type);
  if (!parentMeta) {
    return err(
      reason('unknown-component-type', `"${parentNode.type}" is not a registered component.`, {
        type: parentNode.type,
      }),
    );
  }

  const slotDef = parentMeta.slots?.[target.slot];
  if (!slotDef) {
    return err(
      reason('slot-not-found', `${parentMeta.label} has no "${target.slot}" slot.`, {
        parentType: parentNode.type,
        slot: target.slot,
      }),
    );
  }

  const fragment = typeof typeOrFragment === 'string' ? undefined : typeOrFragment;
  const roots = insertionRoots(typeOrFragment);

  // Cycle prevention: a root that's already a live node in `doc` (a move, re-inserting a cut
  // fragment) can't land at or inside its own current position.
  for (const root of roots) {
    if (root.id === undefined) continue;
    if (root.id === target.parentId || isAncestor(doc, root.id, target.parentId)) {
      return err(
        reason('cycle', 'A node cannot be moved inside its own subtree.', { nodeId: root.id }),
      );
    }
  }

  const ancestorChain = buildAncestorChain(doc, index, registry, target.parentId);

  for (const root of roots) {
    const meta = registry.get(root.type);
    if (!meta) {
      return err(
        reason('unknown-component-type', `"${root.type}" is not a registered component.`, {
          type: root.type,
        }),
      );
    }

    if (meta.capabilities?.insertable === false) {
      return err(
        reason('not-insertable', `${meta.label} cannot be inserted.`, { type: root.type }),
      );
    }
    if (meta.capabilities?.root) {
      return err(
        reason('root-only', `${meta.label} can only be the document root.`, { type: root.type }),
      );
    }

    const slotVerdict = matchAllowDeny(
      slotDef.allow,
      slotDef.deny,
      root.type,
      meta.contentCategories,
    );
    if (slotVerdict === 'denied') {
      return err(
        reason(
          'slot-denied',
          `${parentMeta.label}'s "${target.slot}" slot does not accept ${meta.label}.`,
          { parentType: parentNode.type, slot: target.slot, type: root.type },
        ),
      );
    }
    if (slotVerdict === 'not-allowed') {
      return err(
        reason(
          'slot-not-allowed',
          `${parentMeta.label}'s "${target.slot}" slot only accepts specific component types.`,
          { parentType: parentNode.type, slot: target.slot, type: root.type },
        ),
      );
    }

    const parentVerdict = matchAllowDeny(
      meta.parents?.allow,
      meta.parents?.deny,
      parentNode.type,
      parentMeta.contentCategories,
    );
    if (parentVerdict === 'denied') {
      return err(
        reason('parent-denied', `${meta.label} cannot be placed inside ${parentMeta.label}.`, {
          parentType: parentNode.type,
          type: root.type,
        }),
      );
    }
    if (parentVerdict === 'not-allowed') {
      return err(
        reason('parent-not-allowed', `${meta.label} can only be placed inside specific parents.`, {
          parentType: parentNode.type,
          type: root.type,
        }),
      );
    }

    const requireAncestor = meta.parents?.requireAncestor;
    if (requireAncestor && requireAncestor.length > 0) {
      const satisfied = ancestorChain.some((ancestor) =>
        requireAncestor.some((matcher) => matchesType(matcher, ancestor.type, ancestor.categories)),
      );
      if (!satisfied) {
        return err(
          reason(
            'missing-required-ancestor',
            `${meta.label} must be nested inside ${describeMatchers(requireAncestor)}.`,
            { type: root.type },
          ),
        );
      }
    }

    const globalIssue = checkGlobalContentModel(ancestorChain, {
      type: root.type,
      categories: meta.contentCategories,
    });
    if (globalIssue) return err(globalIssue);

    if (fragment && root.id !== undefined) {
      const nestedIssue = checkFragmentSubtree(fragment, root.id, ancestorChain, registry);
      if (nestedIssue) return err(nestedIssue);
    }
  }

  const existingChildren = (parentNode.slots?.[target.slot] ?? []).filter(
    (id) => id !== excludeFromSlotCount,
  );

  if (slotDef.max !== undefined && existingChildren.length + roots.length > slotDef.max) {
    return err(
      reason(
        'slot-max-exceeded',
        `${parentMeta.label}'s "${target.slot}" slot accepts at most ${slotDef.max} item(s).`,
        { parentType: parentNode.type, slot: target.slot, max: slotDef.max },
      ),
    );
  }

  if (target.at !== undefined && (target.at < 0 || target.at > existingChildren.length)) {
    return err(
      reason(
        'invalid-index',
        `Index ${target.at} is out of range for "${target.slot}" (0-${existingChildren.length}).`,
        { at: target.at, slot: target.slot },
      ),
    );
  }

  if (isLocked(doc, index, target.parentId, 'structure')) {
    return err(
      reason('locked-structure', `${parentMeta.label} is structurally locked.`, {
        parentId: target.parentId,
      }),
    );
  }

  return ok(true);
}

interface InsertionRoot {
  /** The live node ID this root already has in `doc`, if it's an existing subtree (a move). */
  readonly id: NodeId | undefined;
  readonly type: ComponentType;
}

function insertionRoots(typeOrFragment: ComponentType | BuilderFragment): readonly InsertionRoot[] {
  if (typeof typeOrFragment === 'string') return [{ id: undefined, type: typeOrFragment }];
  const roots: InsertionRoot[] = [];
  for (const id of typeOrFragment.roots) {
    const node = typeOrFragment.nodes[id];
    if (node) roots.push({ id, type: node.type });
  }
  return roots;
}

function buildAncestorChain(
  doc: BuilderDocument,
  index: DocumentIndex,
  registry: RegistryMeta,
  startId: NodeId,
): ContentModelNode[] {
  const chain: ContentModelNode[] = [];
  let current: NodeId | undefined = startId;
  while (current !== undefined) {
    const node = doc.nodes[current];
    if (!node) break;
    chain.push({ type: node.type, categories: registry.get(node.type)?.contentCategories ?? [] });
    current = index.parentOf[current];
  }
  return chain;
}

type AllowDenyVerdict = 'ok' | 'denied' | 'not-allowed';

function matchAllowDeny(
  allow: readonly Matcher[] | undefined,
  deny: readonly Matcher[] | undefined,
  type: ComponentType,
  categories: readonly ContentCategory[],
): AllowDenyVerdict {
  if (deny?.some((matcher) => matchesType(matcher, type, categories))) return 'denied';
  if (
    allow &&
    allow.length > 0 &&
    !allow.some((matcher) => matchesType(matcher, type, categories))
  ) {
    return 'not-allowed';
  }
  return 'ok';
}

function describeMatchers(matchers: readonly Matcher[]): string {
  return matchers
    .map((matcher) => (isCategoryMatcher(matcher) ? categoryOf(matcher) : matcher))
    .join(' or ');
}

/**
 * Recursively re-checks the ancestor-chain-dependent global content-model rules (nested
 * interactive content, nested forms, a form control outside a form) for every descendant of a
 * pasted/moved fragment, not just its root — the fragment's *external* context is new, so a
 * descendant several levels down can newly violate one of these even though the fragment's own
 * internal composition didn't change. Per-slot `allow`/`deny` and `parents.*` rules are skipped
 * here: those depend only on a node's direct parent or declared ancestor matchers, neither of
 * which changes for a node that stays in the same place within the fragment.
 */
function checkFragmentSubtree(
  fragment: BuilderFragment,
  nodeId: NodeId,
  ancestorChain: readonly ContentModelNode[],
  registry: RegistryMeta,
): Reason | null {
  const node = fragment.nodes[nodeId];
  if (!node) return null;

  const chainWithSelf: ContentModelNode[] = [
    { type: node.type, categories: registry.get(node.type)?.contentCategories ?? [] },
    ...ancestorChain,
  ];

  for (const childId of Object.values(node.slots ?? {}).flat()) {
    const childNode = fragment.nodes[childId];
    if (!childNode) continue;

    const issue = checkGlobalContentModel(chainWithSelf, {
      type: childNode.type,
      categories: registry.get(childNode.type)?.contentCategories ?? [],
    });
    if (issue) return issue;

    const nestedIssue = checkFragmentSubtree(fragment, childId, chainWithSelf, registry);
    if (nestedIssue) return nestedIssue;
  }

  return null;
}
