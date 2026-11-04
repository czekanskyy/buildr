import { createIndex, type NodeId } from '@next-buildr/core';
import type { RemoveRequest, ShortcutCallbacks } from '../app/contracts.ts';
import type { EditorStore } from '../store/index.ts';
import { hasDescendants, overlayOpen, parentSelection } from './navigation.ts';
import type { ShortcutRegistry } from './registry.ts';

/** What the editor's own shortcuts need from outside: the actions of other modules (PB-085, PB-087). */
export interface ExternalActions {
  readonly copy?: () => boolean | undefined;
  readonly cut?: () => boolean | undefined;
  readonly paste?: () => boolean | undefined;
  readonly save?: () => boolean | undefined;
}

/** The UI-only and removal hooks of the host, read on every key press so they may change between renders. */
export interface HostHooks {
  readonly callbacks?: () => Partial<ShortcutCallbacks> | undefined;
  readonly onRemove?: () => ((request: RemoveRequest) => void) | undefined;
  /** Whether the UI-only keys may run for the key press being handled (`false` for a key aimed outside the editor). */
  readonly uiAllowed?: () => boolean;
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
  host: HostHooks = {},
): () => void {
  /**
   * Every shortcut but Escape is left alone while a menu, list or dialog is open: the key belongs to
   * it (Delete must not remove the node behind a dialog, Ctrl+Z is a text field's own undo).
   */
  const bind = (action: string, handler: () => boolean | undefined) =>
    registry.bind(action, () => (overlayOpen() ? false : handler()));
  /** A UI-only key: not taken (`false`) outside the editor or when the host gave no callback. */
  const ui = (pick: (callbacks: Partial<ShortcutCallbacks>) => (() => void) | undefined) => () => {
    if (host.uiAllowed?.() === false) return false;
    const run = pick(host.callbacks?.() ?? {});
    if (run === undefined) return false;
    run();
    return true;
  };
  const device = (key: '1' | '2' | '3') =>
    ui((callbacks) => callbacks.setDevice && (() => callbacks.setDevice?.(key)));
  const stops = [
    bind('edit.undo', () => store.undo().ok),
    bind('edit.redo', () => store.redo().ok),
    bind('edit.duplicate', () => {
      const ids = actionable(store);
      return ids.length > 0 && store.dispatch({ type: 'node.duplicate', payload: { ids } }).ok;
    }),
    bind('edit.delete', () => {
      const ids = actionable(store);
      if (ids.length === 0) return false;
      const onRemove = host.onRemove?.();
      if (onRemove !== undefined) {
        onRemove({ ids, hasDescendants: hasDescendants(store.getState().doc, ids) });
        return true;
      }
      return store.dispatch({ type: 'node.remove', payload: { ids } }).ok;
    }),
    bind('node.moveUp', () => moveSelected(store, -1)),
    bind('node.moveDown', () => moveSelected(store, 1)),
    bind('selection.all', () => selectAll(store)),
    // Escape goes up one level and clears at the top level; an open menu or dialog gets it first.
    bind('selection.clear', () => {
      if (overlayOpen()) return false;
      const { doc, selectedIds } = store.getState();
      if (selectedIds.length === 0) return false;
      const parent = parentSelection(doc, selectedIds);
      if (parent === null) store.clearSelection();
      else store.select(parent);
      return true;
    }),
    bind('ui.device1', device('1')),
    bind('ui.device2', device('2')),
    bind('ui.device3', device('3')),
    bind(
      'ui.panels',
      ui((callbacks) => callbacks.togglePanels && (() => callbacks.togglePanels?.())),
    ),
    bind(
      'ui.guides',
      ui((callbacks) => callbacks.toggleGuides && (() => callbacks.toggleGuides?.())),
    ),
    bind(
      'ui.findBlock',
      ui((callbacks) => callbacks.focusBlockSearch && (() => callbacks.focusBlockSearch?.())),
    ),
  ];
  const optional = {
    'edit.copy': external.copy,
    'edit.cut': external.cut,
    'edit.paste': external.paste,
    'file.save': external.save,
  } as const;
  for (const [action, handler] of Object.entries(optional)) {
    if (handler !== undefined) stops.push(bind(action, handler));
  }
  return () => {
    for (const stop of stops) stop();
  };
}
