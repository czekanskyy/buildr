import { createIndex, type NodeId } from '@next-buildr/core';
import type { EditorStore } from '../store/index.ts';
import type { ShortcutRegistry } from './registry.ts';

/** What the editor's own shortcuts need from outside: the actions of other modules (PB-085, PB-087). */
export interface ExternalActions {
  readonly copy?: () => boolean | undefined;
  readonly cut?: () => boolean | undefined;
  readonly paste?: () => boolean | undefined;
  readonly save?: () => boolean | undefined;
}

/** The selected nodes that can be acted on: the root is never removed, duplicated or moved. */
function actionable(store: EditorStore): NodeId[] {
  const { doc, selectedIds } = store.getState();
  return selectedIds.filter((id) => id !== doc.root && Object.hasOwn(doc.nodes, id));
}

function moveSelected(store: EditorStore, delta: -1 | 1): boolean {
  const ids = actionable(store);
  const [id] = ids;
  if (ids.length !== 1 || id === undefined) return false;
  const { doc } = store.getState();
  const index = createIndex(doc);
  const parentId = index.parentOf[id];
  const slot = index.slotOf[id];
  const position = index.indexOf[id];
  if (parentId === undefined || slot === undefined || position === undefined) return false;
  const siblings = doc.nodes[parentId]?.slots?.[slot] ?? [];
  const target = position + delta;
  if (target < 0 || target >= siblings.length) return false;
  // `index` is a position in the slot as it is now, so moving down passes the neighbour.
  const result = store.dispatch({
    type: 'node.move',
    payload: { ids: [id], parentId, slot, index: delta === -1 ? target : target + 1 },
  });
  return result.ok;
}

function selectAll(store: EditorStore): boolean {
  const { doc, anchorId } = store.getState();
  if (anchorId === null) return false;
  const index = createIndex(doc);
  const parentId = index.parentOf[anchorId];
  const slot = index.slotOf[anchorId];
  if (parentId === undefined || slot === undefined) return false;
  const siblings = doc.nodes[parentId]?.slots?.[slot] ?? [];
  store.setSelection(siblings);
  return true;
}

/**
 * Binds the shortcuts that act on the store (undo, redo, duplicate, delete, move, select, clear)
 * and the ones other modules provide. Returns the function that unbinds them all. An action that
 * cannot run (nothing selected, a locked node the command refuses) returns `false`, so the key is
 * not swallowed.
 */
export function bindEditorActions(
  registry: ShortcutRegistry,
  store: EditorStore,
  external: ExternalActions = {},
): () => void {
  const stops = [
    registry.bind('edit.undo', () => store.undo().ok),
    registry.bind('edit.redo', () => store.redo().ok),
    registry.bind('edit.duplicate', () => {
      const ids = actionable(store);
      return ids.length > 0 && store.dispatch({ type: 'node.duplicate', payload: { ids } }).ok;
    }),
    registry.bind('edit.delete', () => {
      const ids = actionable(store);
      return ids.length > 0 && store.dispatch({ type: 'node.remove', payload: { ids } }).ok;
    }),
    registry.bind('node.moveUp', () => moveSelected(store, -1)),
    registry.bind('node.moveDown', () => moveSelected(store, 1)),
    registry.bind('selection.all', () => selectAll(store)),
    registry.bind('selection.clear', () => {
      if (store.getState().selectedIds.length === 0) return false;
      store.clearSelection();
      return true;
    }),
  ];
  const optional = {
    'edit.copy': external.copy,
    'edit.cut': external.cut,
    'edit.paste': external.paste,
    'file.save': external.save,
  } as const;
  for (const [action, handler] of Object.entries(optional)) {
    if (handler !== undefined) stops.push(registry.bind(action, handler));
  }
  return () => {
    for (const stop of stops) stop();
  };
}
