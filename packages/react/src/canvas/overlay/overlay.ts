import type { NodeId } from '@next-buildr/core';
import type { CanvasStore } from '../store.ts';
import {
  type Action,
  drawAffordances,
  type Insert,
  measureGeometry,
  toolbarScale,
  type View,
} from './affordances.ts';
import { CHIP_GAP, CHIP_HEIGHT, chipText, placeChip } from './chip.ts';
import { OVERLAY_STYLE, PAGE_STYLE } from './palette.ts';

export interface OverlayOptions {
  readonly onAction?: (payload: Action) => void;
  readonly onInsert?: (payload: Insert) => void;
  readonly document: Document;
  readonly store: CanvasStore;
  /** Warns about a selected node with no `data-bid` element; on outside production by default. */
  readonly warn?: boolean;
  /** The pointer went down on the drag handle of the selected node. */
  readonly onHandleDown?: (event: PointerEvent) => unknown;
  /** The human label of a component type (`Hero`); the type itself is used when absent. */
  readonly labelOf?: (type: string) => string | undefined;
}

export interface Overlay {
  /** The element in the page that holds the shadow root. */
  readonly host: HTMLElement;
  /** Draws now instead of on the next frame. */
  refresh(): void;
  setView(view: View): void;
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
  /** The component type id (the "tag" of the chip), on the primary box of a selected node only. */
  readonly tag?: string;
  /** A hovered node that has slots (a container): drawn dashed. */
  readonly container?: boolean;
  /** Whether the node can be moved with a handle (a selected node other than the root). */
  readonly movable?: boolean;
}

function inProduction(): boolean {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  // biome-ignore lint/complexity/useLiteralKeys: an index signature must be read with brackets
  return proc?.env?.['NODE_ENV'] === 'production';
}

/** Every element that renders `id`: one, or one per Loop repetition. */
function elementsOf(
  doc: Document,
  id: NodeId,
  elements = [...doc.querySelectorAll<HTMLElement>('[data-bid]')],
): HTMLElement[] {
  return elements.filter((el) => el.getAttribute('data-bid') === id);
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
  elements?: HTMLElement[],
  rects?: Map<HTMLElement, DOMRect>,
): Box[] {
  const { selection, hover, doc: replica } = store.getState();
  const root = replica?.root;
  const boxes: Box[] = [];
  const add = (kind: Box['kind'], id: NodeId) => {
    const matches = elementsOf(doc, id, elements);
    matches.forEach((el, index) => {
      const rect = rects?.get(el) ?? el.getBoundingClientRect();
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
        ...(kind === 'selected' && index === 0 && type !== undefined
          ? { tag: el.tagName.toLowerCase() }
          : {}),
        ...(kind === 'hover' && Object.keys(node?.slots ?? {}).length > 0
          ? { container: true }
          : {}),
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
 * A selected box whose edge sits closer to the viewport edge than its outline reaches (offset and
 * width, `4 * k`) would have the outline clipped by the viewport; that edge is pulled in so the
 * outline is drawn whole. An edge that is outside the viewport is the page's own and is left alone.
 */
export function keepOutlineVisible(
  box: Box,
  win: Pick<Window, 'innerWidth' | 'innerHeight'>,
  k = 1,
): Box {
  const m = 4 * k;
  const right = box.left + box.width;
  const bottom = box.top + box.height;
  const left = box.left >= 0 && box.left < m ? m : box.left;
  const top = box.top >= 0 && box.top < m ? m : box.top;
  const r = right <= win.innerWidth && right > win.innerWidth - m ? win.innerWidth - m : right;
  const b =
    bottom <= win.innerHeight && bottom > win.innerHeight - m ? win.innerHeight - m : bottom;
  if (left === box.left && top === box.top && r === right && b === bottom) return box;
  return { ...box, left, top, width: Math.max(0, r - left), height: Math.max(0, b - top) };
}

/** Length of the chip's pop-in animation (`bd-pop` in the palette), in ms. */
const POP_MS = 160;

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
  let popStart = Number.NEGATIVE_INFINITY;
  let destroyed = false;
  let view: View = {};
  let dragging = false;
  let hotGap: string | null = null;
  // A pointer that moves anywhere but over the overlay leaves the hot gap (it may have been rebuilt
  // under the pointer, so `pointerleave` cannot be relied on).
  const clearHot = (event: Event) => {
    if (hotGap !== null && event.target !== host) {
      hotGap = null;
      schedule();
    }
  };
  doc.addEventListener('pointermove', clearHot, true);
  const endDrag = () => {
    if (dragging) {
      dragging = false;
      schedule();
    }
  };
  win.addEventListener('pointerup', endDrag);
  win.addEventListener('pointercancel', endDrag);
  win.addEventListener('blur', endDrag);
  doc.addEventListener('visibilitychange', endDrag);
  const handleDown = (event: PointerEvent) => {
    dragging = options.onHandleDown?.(event) === true;
    schedule();
  };

  // The editor's localized names win over the registry's own labels.
  const labelOf = (type: string) =>
    (view.typeLabels !== undefined && Object.hasOwn(view.typeLabels, type)
      ? view.typeLabels[type]
      : undefined) ?? options.labelOf?.(type);

  const draw = () => {
    frame = undefined;
    if (destroyed) return;
    const { selection } = store.getState();
    const elements = [...doc.querySelectorAll<HTMLElement>('[data-bid]')];

    // The chip pops in when the selection changes, not on every redraw (a scroll redraws each frame).
    // A redraw during the 160ms pop rebuilds the chip, so the animation resumes where it was.
    const now = win.performance.now();
    if (selection !== lastSelection) {
      popStart = now;
      lastSelection = selection;
      for (const id of selection) {
        const first = elementsOf(doc, id, elements)[0];
        if (first !== undefined) openAncestorDetails(first);
      }
    }
    const elapsed = now - popStart;
    const pop = elapsed < POP_MS;

    const wanted = new Set<Element>();
    const state = store.getState();
    for (const id of [...state.selection, ...(state.hover === null ? [] : [state.hover])]) {
      for (const el of elementsOf(doc, id, elements)) wanted.add(el);
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
        if (elementsOf(doc, id, elements).length === 0) {
          if (!warned.has(id)) {
            warned.add(id);
            console.warn(
              `[buildr] node "${id}" has no element with data-bid: it cannot be outlined`,
            );
          }
        }
      }
    }

    const alignOpen = shadow.querySelector('.align-menu')?.hasAttribute('hidden') === false;
    const activeControl = shadow.activeElement?.getAttribute('data-focus-key');
    const rects = new Map(elements.map((el) => [el, el.getBoundingClientRect()]));
    const boxes = computeBoxes(doc, store, labelOf, elements, rects);
    const geometry = measureGeometry(doc, elements, rects);
    host.dataset['theme'] = view.theme ?? 'light';
    // The host scales the frame by `scale`; the chrome is drawn at the inverse (`--k`) so the chip,
    // the outlines and the toolbar keep a constant on-screen size.
    const k = 1 / toolbarScale(view.scale);
    host.style.setProperty('--k', String(k));
    for (const el of elements) {
      el.toggleAttribute(
        'data-buildr-dimmed',
        view.hidden?.includes(el.dataset['bid'] ?? '') ?? false,
      );
    }
    const pendingChips: {
      chip: HTMLElement;
      place: (w: number) => ReturnType<typeof placeChip>;
    }[] = [];
    layer.replaceChildren(
      ...boxes.map((raw) => {
        const box = raw.kind === 'selected' ? keepOutlineVisible(raw, win, k) : raw;
        const el = doc.createElement('div');
        el.className = `box ${box.kind}${box.primary ? '' : ' secondary'}${
          box.container === true ? ' container' : ''
        }`;
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
          chip.className = pop ? 'label pop' : 'label';
          if (pop && elapsed > 0) chip.style.animationDelay = `-${elapsed}ms`;
          const text = chipText(box.name ?? box.label, box.tag);
          chip.textContent = text.name;
          if (text.tag !== undefined) {
            const tag = doc.createElement('span');
            tag.className = 'name';
            tag.textContent = ` · ${text.tag}`;
            chip.append(tag);
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
            unscale: k,
          });
        if (chip !== undefined) {
          // Measured once it is in the page (the box is only attached below, so measure on the layer).
          pendingChips.push({ chip, place });
        }
        if (hasHandle && options.onHandleDown !== undefined && options.onAction === undefined) {
          const handle = doc.createElement('span');
          handle.className = box.top < CHIP_HEIGHT + CHIP_GAP ? 'handle inside' : 'handle';
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
      chip.style.left = `${placed.offsetX}px`;
    }
    if (view.outlines) {
      for (const block of elements) {
        const rect = rects.get(block) as DOMRect;
        const outline = doc.createElement('div');
        outline.className = 'outline';
        Object.assign(outline.style, {
          left: `${rect.left}px`,
          top: `${rect.top}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
        });
        layer.prepend(outline);
      }
    }
    if (!dragging)
      drawAffordances(
        doc,
        layer,
        store,
        view,
        options.onAction,
        options.onInsert,
        handleDown,
        geometry,
        {
          labelOf,
          hotGap: {
            key: hotGap,
            set: (key) => {
              hotGap = key;
            },
          },
        },
      );
    if (alignOpen) {
      layer.querySelector('.align-menu')?.removeAttribute('hidden');
      layer.querySelector('.tool.align')?.setAttribute('aria-expanded', 'true');
    }
    if (activeControl) {
      const control = [...layer.querySelectorAll<HTMLElement>('[data-focus-key]')].find(
        (el) => el.getAttribute('data-focus-key') === activeControl,
      );
      control?.focus({ preventScroll: true });
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
    setView: (next) => {
      view = { ...view, ...next, labels: { ...view.labels, ...next.labels } };
      schedule();
    },
    refresh: () => {
      if (frame !== undefined) win.cancelAnimationFrame(frame);
      draw();
    },
    destroy: () => {
      destroyed = true;
      if (frame !== undefined) win.cancelAnimationFrame(frame);
      unsubscribe();
      doc.removeEventListener('pointermove', clearHot, true);
      win.removeEventListener('pointerup', endDrag);
      win.removeEventListener('pointercancel', endDrag);
      win.removeEventListener('blur', endDrag);
      doc.removeEventListener('visibilitychange', endDrag);
      for (const el of doc.querySelectorAll('[data-buildr-dimmed]'))
        el.removeAttribute('data-buildr-dimmed');
      win.removeEventListener('scroll', schedule, { capture: true });
      win.removeEventListener('resize', schedule);
      observer?.disconnect();
      host.remove();
      pageStyle.remove();
    },
  };
}
