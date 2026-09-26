import { type BuilderDocument, createIndex, type NodeId } from '@next-buildr/core';

/** Where the keyboard moves the selection from the node it is on. */
export type SelectionMove = 'parent' | 'child' | 'next' | 'previous';

export type SelectMode =
  /** The node becomes the whole selection. */
  | 'replace'
  /** Ctrl/Cmd-click: in if it was out, out if it was in. */
  | 'toggle'
  /** Shift-click: in, whatever it was. */
  | 'add';

export interface SelectionState {
  /** In the order they were selected. */
  readonly selectedIds: readonly NodeId[];
  /** The node the selection is centred on: the inspector shows it, moves start from it, ranges will extend from it. */
  readonly anchorId: NodeId | null;
  /** Which repetition of a Loop the (single) selected node is: what the canvas reported on click. */
  readonly selectedInstance: string | undefined;
}

export const EMPTY_SELECTION: SelectionState = {
  selectedIds: [],
  anchorId: null,
  selectedInstance: undefined,
};

const has = (doc: BuilderDocument, id: NodeId) => Object.hasOwn(doc.nodes, id);

/** The selection with every node the document no longer has taken out, and its anchor and instance kept consistent. */
export function normalizeSelection(
  doc: BuilderDocument,
  selection: SelectionState,
): SelectionState {
  const ids: NodeId[] = [];
  for (const id of selection.selectedIds) if (has(doc, id) && !ids.includes(id)) ids.push(id);
  const anchor =
    selection.anchorId !== null && ids.includes(selection.anchorId)
      ? selection.anchorId
      : (ids[ids.length - 1] ?? null);
  const instance = ids.length === 1 && ids[0] === anchor ? selection.selectedInstance : undefined;
  const same =
    ids.length === selection.selectedIds.length &&
    ids.every((id, i) => id === selection.selectedIds[i]) &&
    anchor === selection.anchorId &&
    instance === selection.selectedInstance;
  return same ? selection : { selectedIds: ids, anchorId: anchor, selectedInstance: instance };
}

/** What selecting `id` does to a selection. */
export function selectIn(
  current: SelectionState,
  id: NodeId,
  mode: SelectMode = 'replace',
  instance?: string,
): SelectionState {
  if (mode === 'replace') {
    return { selectedIds: [id], anchorId: id, selectedInstance: instance };
  }
  const present = current.selectedIds.includes(id);
  if (mode === 'toggle' && present) {
    const rest = current.selectedIds.filter((other) => other !== id);
    return {
      selectedIds: rest,
      anchorId: current.anchorId === id ? (rest[rest.length - 1] ?? null) : current.anchorId,
      selectedInstance: undefined,
    };
  }
  return {
    selectedIds: present ? current.selectedIds : [...current.selectedIds, id],
    anchorId: id,
    selectedInstance: undefined,
  };
}

/** The nodes from the root down to `id`, or `[]` when `id` is not in the document. */
export function pathTo(doc: BuilderDocument, id: NodeId): NodeId[] {
  const index = createIndex(doc);
  if (!has(doc, id) || (id !== doc.root && index.parentOf[id] === undefined)) return [];
  const path: NodeId[] = [id];
  let at = id;
  while (index.parentOf[at] !== undefined && path.length <= index.order.length) {
    const parent = index.parentOf[at] as NodeId;
    path.unshift(parent);
    at = parent;
  }
  return path;
}

/** The children of a node, across all of its slots in order. */
function childrenOf(doc: BuilderDocument, id: NodeId): NodeId[] {
  const slots = doc.nodes[id]?.slots ?? {};
  return Object.values(slots)
    .flat()
    .filter((child) => has(doc, child));
}

/**
 * The node one step from `id`: its parent, its first child, or the next or previous sibling (among
 * the parent's children across all slots). `undefined` when there is no such node: the root has no
 * parent or sibling, a leaf has no child, and the ends do not wrap.
 */
export function relativeNode(
  doc: BuilderDocument,
  id: NodeId,
  move: SelectionMove,
): NodeId | undefined {
  if (!has(doc, id)) return undefined;
  const index = createIndex(doc);
  if (move === 'child') return childrenOf(doc, id)[0];
  const parent = index.parentOf[id];
  if (parent === undefined) return undefined;
  if (move === 'parent') return parent;
  const siblings = childrenOf(doc, parent);
  const at = siblings.indexOf(id);
  return siblings[move === 'next' ? at + 1 : at - 1];
}
