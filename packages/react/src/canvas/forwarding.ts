import { nodeElementOf } from './interactions.ts';
import type { CanvasStore } from './store.ts';
import type { CanvasTransport } from './types.ts';

export interface ForwardingOptions {
  readonly document: Document;
  readonly store: CanvasStore;
  readonly transport: () => CanvasTransport | null;
}

/** Keys the editor gets when pressed alone. */
const PLAIN_KEYS: ReadonlySet<string> = new Set(['Delete', 'Backspace', 'Escape']);

/** Letters that, with Ctrl or Cmd, are editor shortcuts: undo, redo, copy, cut, paste, duplicate, select all, save. */
const COMMAND_KEYS: ReadonlySet<string> = new Set(['z', 'y', 'c', 'x', 'v', 'd', 'a', 's']);

/**
 * Whether a key press is one the editor handles. Kept short and clear of the browser's own
 * shortcuts (reload, close tab, address bar, developer tools, find), which are never captured.
 */
export function isEditorShortcut(event: {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
}): boolean {
  const command = event.ctrlKey || event.metaKey;
  if (command && !event.altKey) return COMMAND_KEYS.has(event.key.toLowerCase());
  if (event.altKey && !command) return event.key === 'ArrowUp' || event.key === 'ArrowDown';
  if (!command && !event.altKey) return PLAIN_KEYS.has(event.key);
  return false;
}

/** Whether typing or a context menu in `target` belongs to the page: a text field, or text being edited. */
function isTextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest('input, textarea, select') !== null) return true;
  const editable = target.closest('[contenteditable]');
  return editable !== null && editable.getAttribute('contenteditable') !== 'false';
}

/**
 * Keys and the context menu, for an iframe that has the focus (docs/editor.md#forwarding): the
 * editor's shortcuts (Ctrl/Cmd+Z and friends, Delete, Escape, Alt+Up/Down) go to it as `key:down`
 * and are stopped here so the browser does not act on them too; a right click sends `contextmenu`
 * with the node under it and the pointer's position in the canvas viewport, and the browser's own
 * menu does not open. Nothing is forwarded from a text field or from text being edited in place,
 * where those keys belong to the text, and nothing in interact mode.
 */
export function installForwarding(options: ForwardingOptions): () => void {
  const { document: doc, store } = options;
  const editing = () => store.getState().mode === 'edit';

  const onKeyDown = (event: KeyboardEvent) => {
    if (!editing() || event.isComposing || event.defaultPrevented) return;
    if (isTextTarget(event.target) || store.editing() !== null) return;
    if (!isEditorShortcut(event)) return;
    event.preventDefault();
    if (event.repeat) return;
    options.transport()?.send('key:down', {
      key: event.key.slice(0, 32),
      code: (event.code || event.key).slice(0, 32),
      mods: { shift: event.shiftKey, alt: event.altKey, ctrl: event.ctrlKey, meta: event.metaKey },
    });
  };

  const onContextMenu = (event: MouseEvent) => {
    if (!editing() || isTextTarget(event.target)) return;
    event.preventDefault();
    const id = nodeElementOf(event.target)?.getAttribute('data-bid') ?? null;
    options.transport()?.send('contextmenu', { id, point: { x: event.clientX, y: event.clientY } });
  };

  doc.addEventListener('keydown', onKeyDown, true);
  doc.addEventListener('contextmenu', onContextMenu, true);
  return () => {
    doc.removeEventListener('keydown', onKeyDown, true);
    doc.removeEventListener('contextmenu', onContextMenu, true);
  };
}
