import type { Diagnostic } from '../result/diagnostic.ts';
import { type BuilderDocument, type NodeId, ROOT_COMPONENT_TYPE, type SlotName } from './types.ts';

/**
 * Checks the cross-node invariants that `documentSchema` (shape/format only) can't express (see
 * docs/document-model.md#invariants): the root exists and is of the root type; every map key
 * matches its node's `id`; every non-root node is reachable from the root through exactly one
 * slot; no cycles; `anchor` values are unique. Tolerant of a corrupted document — never throws
 * (see docs/ai/coding-rules.md) — this is exactly what's meant to report the corruption.
 *
 * Slot names existing on the node's component (per docs/document-model.md#invariants) isn't
 * checked here yet — there's no component registry to check against until PB-013+.
 */
export function checkInvariants(doc: BuilderDocument): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const nodeIds = Object.keys(doc.nodes);

  for (const key of nodeIds) {
    const keyedNode = doc.nodes[key];
    if (keyedNode && keyedNode.id !== key) {
      diagnostics.push({
        code: 'document.node-id-mismatch',
        message: `the node stored under key "${key}" has id "${keyedNode.id}"`,
        severity: 'error',
        path: ['nodes', key],
        details: { mapKey: key, nodeId: keyedNode.id },
      });
    }
  }

  const rootNode = doc.nodes[doc.root];
  if (!rootNode) {
    diagnostics.push({
      code: 'document.root-missing',
      message: `the document has no node at its root key "${doc.root}"`,
      severity: 'error',
      path: ['nodes', doc.root],
    });
  } else if (rootNode.type !== ROOT_COMPONENT_TYPE) {
    diagnostics.push({
      code: 'document.root-wrong-type',
      message: `the root node's type is "${rootNode.type}", expected "${ROOT_COMPONENT_TYPE}"`,
      severity: 'error',
      path: ['nodes', doc.root, 'type'],
      details: { actual: rootNode.type, expected: ROOT_COMPONENT_TYPE },
    });
  }

  const references = collectReferences(doc, diagnostics);

  for (const id of nodeIds) {
    if (id === doc.root) continue;
    const refs = references.get(id) ?? [];
    if (refs.length > 1) {
      diagnostics.push({
        code: 'document.multiple-parents',
        message: `node "${id}" appears in ${refs.length} slots, expected exactly one`,
        severity: 'error',
        path: ['nodes', id],
        details: { parents: refs.map((ref) => `${ref.parentId}.${ref.slot}`) },
      });
    }
  }

  if (rootNode) diagnostics.push(...checkReachability(doc, nodeIds));

  diagnostics.push(...checkDuplicateAnchors(doc));

  return diagnostics;
}

interface SlotReference {
  readonly parentId: NodeId;
  readonly slot: SlotName;
}

/** Every slot child reference in the document, keyed by the referenced child's ID. */
function collectReferences(
  doc: BuilderDocument,
  diagnostics: Diagnostic[],
): Map<NodeId, SlotReference[]> {
  const references = new Map<NodeId, SlotReference[]>();

  for (const [parentId, parentNode] of Object.entries(doc.nodes)) {
    for (const [slot, children] of Object.entries(parentNode.slots ?? {})) {
      for (const childId of children) {
        if (childId === doc.root) {
          diagnostics.push({
            code: 'document.root-referenced-as-child',
            message: `slot "${slot}" on node "${parentId}" lists the root as a child`,
            severity: 'error',
            path: ['nodes', parentId, 'slots', slot],
          });
          continue;
        }
        if (!doc.nodes[childId]) {
          diagnostics.push({
            code: 'document.dangling-child',
            message: `slot "${slot}" on node "${parentId}" references missing node "${childId}"`,
            severity: 'error',
            path: ['nodes', parentId, 'slots', slot],
            details: { childId },
          });
          continue;
        }
        const list = references.get(childId) ?? [];
        list.push({ parentId, slot });
        references.set(childId, list);
      }
    }
  }

  return references;
}

/** Every node reachable from the root, then splits everything else into cycles vs. plain orphans. */
function checkReachability(doc: BuilderDocument, nodeIds: readonly NodeId[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const reachable = new Set<NodeId>([doc.root]);
  const queue: NodeId[] = [doc.root];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (currentId === undefined) break;
    const currentNode = doc.nodes[currentId];
    if (!currentNode) continue;
    for (const children of Object.values(currentNode.slots ?? {})) {
      for (const childId of children) {
        if (reachable.has(childId) || !doc.nodes[childId]) continue;
        reachable.add(childId);
        queue.push(childId);
      }
    }
  }

  const unreached = nodeIds.filter((id) => id !== doc.root && !reachable.has(id));
  const reportedAsCycle = new Set<NodeId>();

  for (const id of unreached) {
    if (reportedAsCycle.has(id)) continue;
    const cycle = findCycleFrom(doc, id);
    if (!cycle) continue;
    for (const memberId of cycle) {
      if (reportedAsCycle.has(memberId)) continue;
      reportedAsCycle.add(memberId);
      diagnostics.push({
        code: 'document.cycle',
        message: `node "${memberId}" is part of a cycle: ${cycle.join(' -> ')}`,
        severity: 'error',
        path: ['nodes', memberId],
        details: { cycle },
      });
    }
  }

  for (const id of unreached) {
    if (reportedAsCycle.has(id)) continue;
    diagnostics.push({
      code: 'document.orphan-node',
      message: `node "${id}" is unreachable from the root`,
      severity: 'error',
      path: ['nodes', id],
    });
  }

  return diagnostics;
}

/**
 * Depth-first search from `startId` looking for a back-edge to a node already on the current
 * path. Returns the cycle (nearest repeat first) if found, `undefined` for a plain dangling
 * subtree with no internal cycle.
 */
function findCycleFrom(doc: BuilderDocument, startId: NodeId): NodeId[] | undefined {
  const path: NodeId[] = [];
  const onPath = new Set<NodeId>();
  const finished = new Set<NodeId>();

  function visit(id: NodeId): NodeId[] | undefined {
    if (onPath.has(id)) return path.slice(path.indexOf(id)).concat(id);
    if (finished.has(id)) return undefined;
    const node = doc.nodes[id];
    if (!node) return undefined;

    path.push(id);
    onPath.add(id);
    for (const children of Object.values(node.slots ?? {})) {
      for (const childId of children) {
        const found = visit(childId);
        if (found) return found;
      }
    }
    path.pop();
    onPath.delete(id);
    finished.add(id);
    return undefined;
  }

  return visit(startId);
}

function checkDuplicateAnchors(doc: BuilderDocument): Diagnostic[] {
  const owners = new Map<string, NodeId[]>();
  for (const [id, node] of Object.entries(doc.nodes)) {
    if (!node.anchor) continue;
    const list = owners.get(node.anchor) ?? [];
    list.push(id);
    owners.set(node.anchor, list);
  }

  const diagnostics: Diagnostic[] = [];
  for (const [anchor, ownerIds] of owners) {
    if (ownerIds.length <= 1) continue;
    diagnostics.push({
      code: 'document.duplicate-anchor',
      message: `anchor "${anchor}" is used by ${ownerIds.length} nodes: ${ownerIds.join(', ')}`,
      severity: 'error',
      details: { anchor, nodeIds: ownerIds },
    });
  }
  return diagnostics;
}

/**
 * Throws if `doc` violates any invariant `checkInvariants` reports. For dev/test call sites only
 * (see docs/ai/testing-rules.md) — once commands are the only mutation path, a violation here
 * means a bug in the code that produced `doc`, not bad user data, so throwing (rather than
 * returning a `Diagnostic`) is correct here (see docs/ai/architecture-rules.md #7).
 */
export function assertDocumentInvariants(doc: BuilderDocument): void {
  const diagnostics = checkInvariants(doc);
  if (diagnostics.length === 0) return;
  const summary = diagnostics.map((d) => `${d.code} (${d.message})`).join('; ');
  throw new Error(`document invariants violated: ${summary}`);
}
