import type { NodeId } from '@buildr/core';
import type { CanvasStore } from '../store.ts';

export interface OverlayOptions {
  readonly document: Document;
  readonly store: CanvasStore;
  /** Warns about a selected node with no `data-bid` element; on outside production by default. */
  readonly warn?: boolean;
}

export interface Overlay {
  /** The element in the page that holds the shadow root. */
  readonly host: HTMLElement;
  /** Draws now instead of on the next frame. */
  refresh(): void;
  destroy(): void;
}

export interface Box {
  readonly kind: 'selected' | 'hover';
  /** The first repetition of a node in a Loop, or its only element; the others are drawn dashed. */
  readonly primary: boolean;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  /** The type label, on the primary box of a selected node only. */
  readonly label?: string;
}

const STYLE = `
:host { all: initial; }
.layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483647; }
.box { position: fixed; box-sizing: border-box; pointer-events: none; }
.box.selected { outline: 2px solid #2563eb; outline-offset: -1px; }
.box.hover { outline: 1px solid #60a5fa; outline-offset: -1px; }
.box.secondary { outline-style: dashed; }
.label { position: absolute; left: -1px; top: -20px; padding: 1px 6px; font: 600 11px/18px system-ui, sans-serif;
  color: #fff; background: #2563eb; white-space: nowrap; }
.label.inside { top: 0; }
`;

function inProduction(): boolean {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env?.['NODE_ENV'] === 'production';
}

/** Every element that renders `id`: one, or one per Loop repetition. */
function elementsOf(doc: Document, id: NodeId): HTMLElement[] {
  return [...doc.querySelectorAll<HTMLElement>('[data-bid]')].filter(
    (el) => el.getAttribute('data-bid') === id,
  );
}

/** Opens the `<details>` a node is inside, so selecting a node in a collapsed one shows it. */
export function openAncestorDetails(element: Element): boolean {
  let opened = false;
  for (let el = element.parentElement; el !== null; el = el.parentElement) {
    if (el instanceof HTMLDetailsElement && !el.open) {
      el.open = true;
      opened = true;
    }
  }
  return opened;
}

/**
 * The boxes to draw for the current selection and hover, read from the page's own layout. Reads
 * `getBoundingClientRect` only (viewport-relative, which is what `position: fixed` wants, so a
 * fixed or sticky element is drawn where it is).
 */
export function computeBoxes(doc: Document, store: CanvasStore): Box[] {
  const { selection, hover } = store.getState();
  const boxes: Box[] = [];
  const add = (kind: Box['kind'], id: NodeId) => {
    const elements = elementsOf(doc, id);
    elements.forEach((el, index) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      const type = store.getNode(id)?.type;
      boxes.push({
        kind,
        primary: index === 0,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        ...(kind === 'selected' && index === 0 && type !== undefined ? { label: type } : {}),
      });
    });
  };
  if (hover !== null && !selection.includes(hover)) add('hover', hover);
  for (const id of selection) add('selected', id);
  return boxes;
}

/**
 * The selection and hover overlay. It lives in a shadow root on a `position: fixed`,
 * `pointer-events: none` host, so the site's styles do not reach it and it does not take part in the
 * site's layout or receive its events. It is redrawn on the next animation frame after a scroll, a
 * resize, a change of selection, hover or document, and when one of the (at most a few) elements it
 * outlines changes size.
 */
export function createOverlay(options: OverlayOptions): Overlay {
  const { document: doc, store } = options;
  const win = doc.defaultView;
  if (win === null) throw new Error('the document has no window');
  const warn = options.warn ?? !inProduction();

  const host = doc.createElement('div');
  host.setAttribute('data-buildr-overlay', '');
  const shadow = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = STYLE;
  const layer = doc.createElement('div');
  layer.className = 'layer';
  shadow.append(style, layer);
  doc.body.append(host);

  const observed = new Set<Element>();
  const observer =
    typeof win.ResizeObserver === 'function' ? new win.ResizeObserver(() => schedule()) : undefined;
  const warned = new Set<NodeId>();
  let frame: number | undefined;
  let lastSelection: readonly NodeId[] = [];
  let destroyed = false;

  const draw = () => {
    frame = undefined;
    if (destroyed) return;
    const { selection } = store.getState();

    if (selection !== lastSelection) {
      lastSelection = selection;
      for (const id of selection) {
        const first = elementsOf(doc, id)[0];
        if (first !== undefined) openAncestorDetails(first);
      }
    }

    const wanted = new Set<Element>();
    const state = store.getState();
    for (const id of [...state.selection, ...(state.hover === null ? [] : [state.hover])]) {
      for (const el of elementsOf(doc, id)) wanted.add(el);
    }
    for (const el of observed) {
      if (!wanted.has(el)) {
        observer?.unobserve(el);
        observed.delete(el);
      }
    }
    for (const el of wanted) {
      if (!observed.has(el)) {
        observer?.observe(el);
        observed.add(el);
      }
    }

    if (warn) {
      for (const id of selection) {
        if (elementsOf(doc, id).length === 0) {
          if (!warned.has(id)) {
            warned.add(id);
            console.warn(
              `[buildr] node "${id}" has no element with data-bid: it cannot be outlined`,
            );
          }
        }
      }
    }

    const boxes = computeBoxes(doc, store);
    layer.replaceChildren(
      ...boxes.map((box) => {
        const el = doc.createElement('div');
        el.className = `box ${box.kind}${box.primary ? '' : ' secondary'}`;
        el.style.left = `${box.left}px`;
        el.style.top = `${box.top}px`;
        el.style.width = `${box.width}px`;
        el.style.height = `${box.height}px`;
        if (box.label !== undefined) {
          const label = doc.createElement('span');
          label.className = box.top < 22 ? 'label inside' : 'label';
          label.textContent = box.label;
          el.append(label);
        }
        return el;
      }),
    );
  };

  function schedule() {
    if (destroyed || frame !== undefined) return;
    frame = win?.requestAnimationFrame(draw);
  }

  const unsubscribe = store.subscribe(schedule);
  win.addEventListener('scroll', schedule, { capture: true, passive: true });
  win.addEventListener('resize', schedule);
  schedule();

  return {
    host,
    refresh: () => {
      if (frame !== undefined) win.cancelAnimationFrame(frame);
      draw();
    },
    destroy: () => {
      destroyed = true;
      if (frame !== undefined) win.cancelAnimationFrame(frame);
      unsubscribe();
      win.removeEventListener('scroll', schedule, { capture: true });
      win.removeEventListener('resize', schedule);
      observer?.disconnect();
      host.remove();
    },
  };
}
