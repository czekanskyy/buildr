import { MAX_INLINE_TEXT } from '@next-buildr/core/protocol';
import { nodeElementOf } from './interactions.ts';
import type { CanvasStore } from './store.ts';
import type { CanvasTransport } from './types.ts';

export interface InlineEditOptions {
  readonly document: Document;
  readonly store: CanvasStore;
  readonly transport: () => CanvasTransport | null;
  /** The prop a component type lets the author edit on the canvas (`editor.inlineProp`), if any. */
  readonly inlineProp: (type: string) => string | undefined;
}

/** The text an author can edit in place: a static, non-localized string. */
function editableText(store: CanvasStore, id: string, prop: string): string | undefined {
  const value = store.getNode(id)?.props?.[prop] as
    | { kind?: unknown; value?: unknown; l10n?: unknown }
    | undefined;
  if (value?.kind !== 'static' || typeof value.value !== 'string' || value.l10n !== undefined) {
    return undefined;
  }
  return value.value;
}

interface Session {
  readonly id: string;
  readonly prop: string;
  readonly element: HTMLElement;
  readonly original: string;
  /** The browser has no plaintext-only editing: pasting has to be turned into text by hand. */
  readonly pastePlain: boolean;
}

/**
 * Editing text on the canvas (docs/editor.md#inline-editing). A double click on a component that
 * names an `inlineProp` whose value is a static string makes its element editable in place:
 * `contenteditable="plaintext-only"`, or plain `true` plus pasting as text where the browser lacks
 * it. Enter or leaving the element commits (`inline:commit`, once, and only when the text changed),
 * Escape puts the old text back. The node's view is frozen for the session (`store.beginEdit`), so
 * a patch that arrives mid-edit is kept but not shown until the edit ends, and typing never
 * re-renders anything: the caret cannot jump.
 */
export function installInlineEdit(options: InlineEditOptions): () => void {
  const { document: doc, store } = options;
  let session: Session | undefined;

  const end = (commit: boolean) => {
    const current = session;
    if (current === undefined) return;
    session = undefined; // first, so the blur this causes does not commit again
    const { element } = current;
    const text = element.textContent ?? '';
    element.removeEventListener('keydown', onKeyDown);
    element.removeEventListener('focusout', onBlur);
    element.removeEventListener('paste', onPaste);
    element.removeAttribute('contenteditable');
    if (!commit || text === current.original || text.length > MAX_INLINE_TEXT) {
      element.textContent = current.original;
    } else {
      options
        .transport()
        ?.send('inline:commit', { id: current.id, prop: current.prop, value: text });
    }
    if (element.isConnected && doc.activeElement === element) element.blur();
    store.endEdit();
  };

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      end(false);
    } else if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      end(true);
    }
    // Nothing else leaves the element: typing is the author's, not a shortcut.
    event.stopPropagation();
  }
  function onBlur() {
    end(true);
  }
  function onPaste(event: ClipboardEvent) {
    if (session?.pastePlain !== true) return;
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') ?? '';
    doc.execCommand?.('insertText', false, text);
  }

  const onDoubleClick = (event: MouseEvent) => {
    if (store.getState().mode !== 'edit' || session !== undefined) return;
    const element = nodeElementOf(event.target);
    if (element === null) return;
    const id = element.getAttribute('data-bid') ?? '';
    const type = store.getNode(id)?.type;
    const prop = type === undefined ? undefined : options.inlineProp(type);
    if (prop === undefined) return;
    const original = editableText(store, id, prop);
    if (original === undefined) return;

    store.beginEdit(id);
    element.setAttribute('contenteditable', 'plaintext-only');
    const plain = element.contentEditable === 'plaintext-only';
    if (!plain) element.setAttribute('contenteditable', 'true');
    session = { id, prop, element, original, pastePlain: !plain };
    element.addEventListener('keydown', onKeyDown);
    element.addEventListener('focusout', onBlur);
    element.addEventListener('paste', onPaste);
    element.focus();
  };

  // Registered in the capture phase like the rest, and before `installInteractions`, so the double
  // click still reaches the editor as `node:dblclick`.
  doc.addEventListener('dblclick', onDoubleClick, true);
  return () => {
    doc.removeEventListener('dblclick', onDoubleClick, true);
    end(false);
  };
}
