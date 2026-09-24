import {
  type BuilderDocument,
  createIndex,
  type DocumentIndex,
  type NodeId,
  type PageNode,
  type SlotName,
} from '@buildr/core';
import type { EditorState } from './types.ts';

const indexes = new WeakMap<BuilderDocument, DocumentIndex>();

/**
 * The parent/slot index of the document, built when first asked for and reused until the document
 * changes (a new document is a new object, so the cache needs no invalidation).
 */
export function selectIndex(state: Pick<EditorState, 'doc'>): DocumentIndex {
  let index = indexes.get(state.doc);
  if (index === undefined) {
    index = createIndex(state.doc);
    indexes.set(state.doc, index);
  }
  return index;
}

/** A node, or `undefined`. The same object until that node changes (structural sharing). */
export function selectNode(state: Pick<EditorState, 'doc'>, id: NodeId): PageNode | undefined {
  return Object.hasOwn(state.doc.nodes, id) ? state.doc.nodes[id] : undefined;
}

const NO_CHILDREN: readonly NodeId[] = Object.freeze([]);

/** The children of a node in one slot; the same array until it changes. */
export function selectChildren(
  state: Pick<EditorState, 'doc'>,
  id: NodeId,
  slot: SlotName = 'default',
): readonly NodeId[] {
  const slots = selectNode(state, id)?.slots;
  return slots !== undefined && Object.hasOwn(slots, slot)
    ? (slots[slot] ?? NO_CHILDREN)
    : NO_CHILDREN;
}

/** The first selected node, if any. */
export function selectSelectedNode(
  state: Pick<EditorState, 'doc' | 'selectedIds'>,
): PageNode | undefined {
  const [first] = state.selectedIds;
  return first === undefined ? undefined : selectNode(state, first);
}

/** Whether the document differs from the saved one; undoing back to the saved state is clean again. */
export function selectIsDirty(state: Pick<EditorState, 'cursorId' | 'savedCursorId'>): boolean {
  return state.cursorId !== state.savedCursorId;
}
