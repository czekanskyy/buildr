import type { NodeId } from '@buildr/core';
import type { CanvasTransport } from './runtime.tsx';
import type { CanvasStore } from './store.ts';

export interface InteractionOptions {
  readonly document: Document;
  readonly store: CanvasStore;
  /** The channel to the editor; `null` while there is none. */
  readonly transport: () => CanvasTransport | null;
}

/** The `data-bid` element a DOM target is inside, if any. */
export function nodeElementOf(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const found = target.closest('[data-bid]');
  return found instanceof HTMLElement ? found : null;
}

/**
 * Which Loop repetition an element is in, as the `data-bi` indices of it and of its ancestors,
 * outermost first and joined with `.` (`"2"`, `"1.3"`); `undefined` outside any loop.
 */
export function instanceOf(element: Element): string | undefined {
  const indices: string[] = [];
  for (let el: Element | null = element; el !== null; el = el.parentElement) {
    const index = el.getAttribute('data-bi');
    if (index !== null) indices.unshift(index);
  }
  return indices.length === 0 ? undefined : indices.join('.').slice(0, 200);
}

function modifiersOf(event: MouseEvent) {
  return { shift: event.shiftKey, alt: event.altKey, ctrl: event.ctrlKey, meta: event.metaKey };
}

/**
 * Capture-phase listeners on the page (docs/editor.md#canvas-runtime): in edit mode a click selects
 * the node under it instead of following a link or pressing a button, a submit never goes through,
 * hovering reports the node under the pointer and a double click reports the node to edit. Events
 * are stopped in the capture phase, so the site's own handlers never see them. In interact mode
 * nothing is captured. Returns the function that removes the listeners.
 */
export function installInteractions(options: InteractionOptions): () => void {
  const { document: doc, store } = options;
  const editing = () => store.getState().mode === 'edit';
  let hovered: NodeId | null = null;

  const pointer = (event: MouseEvent, type: 'node:click' | 'node:dblclick') => {
    if (!editing() || event.button !== 0) return;
    const element = nodeElementOf(event.target);
    // Stopped even when it is on no node: a link outside every node must not navigate either.
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (element === null) return;
    const instance = instanceOf(element);
    options.transport()?.send(type, {
      id: element.getAttribute('data-bid') ?? '',
      ...(instance !== undefined ? { instance } : {}),
      modifiers: modifiersOf(event),
    });
  };

  const onClick = (event: MouseEvent) => pointer(event, 'node:click');
  const onDoubleClick = (event: MouseEvent) => pointer(event, 'node:dblclick');

  const hover = (id: NodeId | null, instance?: string) => {
    if (id === hovered) return;
    hovered = id;
    options.transport()?.send('node:hover', {
      id,
      ...(instance !== undefined ? { instance } : {}),
      modifiers: { shift: false, alt: false, ctrl: false, meta: false },
    });
  };

  const onOver = (event: MouseEvent) => {
    if (!editing()) return;
    const element = nodeElementOf(event.target);
    const instance = element === null ? undefined : instanceOf(element);
    hover(element?.getAttribute('data-bid') ?? null, instance);
  };
  const onLeave = (event: MouseEvent) => {
    if (event.relatedTarget === null) hover(null);
  };

  const onSubmit = (event: Event) => {
    if (!editing()) return;
    event.preventDefault();
    event.stopPropagation();
  };

  doc.addEventListener('click', onClick, true);
  doc.addEventListener('dblclick', onDoubleClick, true);
  doc.addEventListener('mouseover', onOver, true);
  doc.addEventListener('mouseout', onLeave, true);
  doc.addEventListener('submit', onSubmit, true);
  return () => {
    doc.removeEventListener('click', onClick, true);
    doc.removeEventListener('dblclick', onDoubleClick, true);
    doc.removeEventListener('mouseover', onOver, true);
    doc.removeEventListener('mouseout', onLeave, true);
    doc.removeEventListener('submit', onSubmit, true);
  };
}
