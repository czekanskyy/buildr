import type { NodeId } from '@buildr/core';
import type { CanvasStore } from '../store.ts';
import { CHIP_HEIGHT, placeChip } from './chip.ts';
import { OVERLAY_STYLE, PAGE_STYLE } from './palette.ts';

export interface OverlayOptions {
  readonly document: Document;
  readonly store: CanvasStore;
  /** Warns about a selected node with no `data-bid` element; on outside production by default. */
  readonly warn?: boolean;
  /** The pointer went down on the drag handle of the selected node. */
  readonly onHandleDown?: (event: PointerEvent) => void;
  /** The human label of a component type (`Hero`); the type itself is used when absent. */
  readonly labelOf?: (type: string) => string | undefined;
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
  /** The component label (or its type), on the primary box of a selected node only. */
  readonly label?: string;
  /** The node's own name (layers-panel label), when it has one. */
  readonly name?: string;
  /** Whether the node can be moved with a handle (a selected node other than the root). */
  readonly movable?: boolean;
}

function inProduction(): boolean {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  // biome-ignore lint/complexity/useLiteralKeys: an index signature must be read with brackets
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
export function computeBoxes(
  doc: Document,
  store: CanvasStore,
  labelOf?: (type: string) => string | undefined,
): Box[] {
  const { selection, hover, doc: replica } = store.getState();
  const root = replica?.root;
  const boxes: Box[] = [];
  const add = (kind: Box['kind'], id: NodeId) => {
    const elements = elementsOf(doc, id);
    elements.forEach((el, index) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      const node = store.getNode(id);
      const type = node?.type;
      boxes.push({
        kind,
        primary: index === 0,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        ...(kind === 'selected' && index === 0 && type !== undefined
          ? { label: labelOf?.(type) ?? type }
          : {}),
        ...(kind === 'selected' && index === 0 && node?.name ? { name: node.name } : {}),
        ...(kind === 'selected' && index === 0 && root !== undefined && id !== root
          ? { movable: true }
          : {}),
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
  style.textContent = OVERLAY_STYLE;
  const layer = doc.createElement('div');
  layer.className = 'layer';
  shadow.append(style, layer);
  doc.body.append(host);
  // The empty-slot placeholder is part of the page, so its style goes into the page (namespaced).
  const pageStyle = doc.createElement('style');
  pageStyle.setAttribute('data-buildr-canvas-style', '');
  pageStyle.textContent = PAGE_STYLE;
  doc.head.append(pageStyle);

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

    const boxes = computeBoxes(doc, store, options.labelOf);
    const pendingChips: {
      chip: HTMLElement;
      place: (w: number) => ReturnType<typeof placeChip>;
    }[] = [];
    layer.replaceChildren(
      ...boxes.map((box) => {
        const el = doc.createElement('div');
        el.className = `box ${box.kind}${box.primary ? '' : ' secondary'}`;
        el.style.left = `${box.left}px`;
        el.style.top = `${box.top}px`;
        el.style.width = `${box.width}px`;
        el.style.height = `${box.height}px`;
        const hasHandle =
          box.movable === true &&
          options.onHandleDown !== undefined &&
          store.getState().mode === 'edit';
        let chip: HTMLElement | undefined;
        if (box.label !== undefined) {
          chip = doc.createElement('span');
          chip.className = 'label';
          chip.textContent = box.label;
          if (box.name !== undefined && box.name !== box.label) {
            const name = doc.createElement('span');
            name.className = 'name';
            name.textContent = ` · ${box.name}`;
            chip.append(name);
          }
          el.append(chip);
        }
        const place = (chipWidth: number) =>
          placeChip({
            boxLeft: box.left,
            boxTop: box.top,
            chipWidth,
            viewportWidth: win.innerWidth,
            reservedRight: hasHandle ? CHIP_HEIGHT : 0,
          });
        if (chip !== undefined) {
          // Measured once it is in the page (the box is only attached below, so measure on the layer).
          pendingChips.push({ chip, place });
        }
        if (hasHandle && options.onHandleDown !== undefined) {
          const handle = doc.createElement('span');
          handle.className = box.top < CHIP_HEIGHT ? 'handle inside' : 'handle';
          if (box.top < 0) handle.style.top = `${-box.top}px`;
          handle.setAttribute('data-buildr-handle', '');
          handle.textContent = '✥';
          handle.addEventListener('pointerdown', options.onHandleDown);
          el.append(handle);
        }
        return el;
      }),
    );
    for (const { chip, place } of pendingChips) {
      const placed = place(chip.offsetWidth);
      if (placed.placement === 'inside') {
        chip.classList.add('inside');
        chip.style.top = `${placed.offsetY}px`;
      }
      if (placed.offsetX !== 0) chip.style.left = `${placed.offsetX}px`;
    }
    const drop = store.getState().drop;
    if (drop !== null) {
      const el = doc.createElement('div');
      el.className = `drop ${drop.kind}${
        drop.kind === 'line' ? (drop.rect.width >= drop.rect.height ? ' h' : ' v') : ''
      }`;
      el.setAttribute('data-buildr-drop', drop.kind);
      el.style.left = `${drop.rect.x}px`;
      el.style.top = `${drop.rect.y}px`;
      el.style.width = `${drop.rect.width}px`;
      el.style.height = `${drop.rect.height}px`;
      if (drop.kind === 'forbidden' && drop.message !== undefined) {
        const reason = doc.createElement('span');
        reason.className = 'reason';
        reason.textContent = drop.message;
        el.append(reason);
      }
      layer.append(el);
    }
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
      pageStyle.remove();
    },
  };
}
