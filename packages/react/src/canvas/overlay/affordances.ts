import type { CanvasMessage, EditorMessage } from '@next-buildr/core/protocol';
import type { CanvasStore } from '../store.ts';
export type View = Extract<EditorMessage, { type: 'view:set' }>['payload'];
export type Action = Extract<CanvasMessage, { type: 'intent:action' }>['payload'];
export type Insert = Extract<CanvasMessage, { type: 'intent:insert' }>['payload'];

/**
 * All geometry stays in iframe CSS pixels, including when its host scales the iframe. `scale` is
 * the scale the host applies to the frame: the toolbar is drawn at the inverse, so its on-screen
 * size is constant, and every on-screen distance here (label room, margins) is divided by it. The
 * `width` is the toolbar's own, unscaled width.
 */
export function placeToolbar(
  rect: Pick<DOMRect, 'left' | 'top' | 'bottom'>,
  viewportWidth: number,
  width: number,
  viewportHeight = Number.POSITIVE_INFINITY,
  scale = 1,
) {
  const k = 1 / toolbarScale(scale);
  const height = rect.bottom - rect.top;
  // Above the block (and its label chip) when it fits; flipped below the block when there is no
  // room above, like the design template; a block that runs past the bottom too gets the toolbar
  // inside its top edge (a tall one) or pinned to the bottom edge, so it is always on screen.
  const below = rect.bottom + 10 * k;
  const top =
    rect.top >= 72 * k
      ? rect.top - 72 * k
      : below + 40 * k <= viewportHeight
        ? below
        : height >= 96 * k
          ? Math.max(8 * k, Math.min(Math.max(rect.top, 0) + 8 * k, viewportHeight - 48 * k))
          : Math.max(0, Math.min(below, viewportHeight - 40 * k));
  return { left: Math.max(0, Math.min(rect.left, viewportWidth - width * k)), top };
}
/** A usable scale: the editor's value when it is a positive finite number, else 1. */
export function toolbarScale(scale: number | undefined): number {
  return scale !== undefined && Number.isFinite(scale) && scale > 0 ? scale : 1;
}
const paths = {
  selectParent: 'M14 9 9 4 4 9 M20 20h-7a4 4 0 0 1-4-4V4',
  drag: 'M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01',
  moveUp: 'm18 15-6-6-6 6',
  moveDown: 'm6 9 6 6 6-6',
  align: 'M21 6H3 M15 12H3 M17 18H3',
  alignLeft: 'M21 6H3 M15 12H3 M17 18H3',
  alignCenter: 'M21 6H3 M6 12h12 M4 18h16',
  alignRight: 'M21 6H3 M9 12h12 M7 18h14',
  duplicate: 'M8 8h13v13H8z M4 16H2V2h14v2',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  remove: 'M3 6h18 M19 6v14H5V6 M8 6V2h8v4',
  insert: 'M5 12h14 M12 5v14',
} as const;
/** Read page layout once, before overlay writes. Keep the first repetition for insertion. */
export function measureGeometry(
  doc: Document,
  elements = [...doc.querySelectorAll<HTMLElement>('[data-bid]')],
  rects = new Map(elements.map((el) => [el, el.getBoundingClientRect()])),
) {
  const geometry = new Map<string, { rect: DOMRect; visible: boolean }>();
  for (const el of elements) {
    const id = el.dataset['bid'];
    if (!id || geometry.has(id)) continue;
    const rect = rects.get(el) as DOMRect;
    let visible = rect.bottom >= 0 && rect.top <= (doc.defaultView?.innerHeight ?? 0);
    for (let parent = el.parentElement; parent; parent = parent.parentElement) {
      const css = doc.defaultView?.getComputedStyle(parent);
      if (
        /(auto|scroll|hidden|clip)/.test(`${css?.overflow} ${css?.overflowY} ${css?.overflowX}`)
      ) {
        const clip = parent.getBoundingClientRect();
        visible &&=
          rect.bottom > clip.top &&
          rect.top < clip.bottom &&
          rect.right > clip.left &&
          rect.left < clip.right;
      }
    }
    geometry.set(id, { rect, visible });
  }
  return geometry;
}
function eventPoint(e: MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  return e.detail === 0
    ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    : { x: e.clientX, y: e.clientY };
}
export interface AffordanceExtras {
  /** The human label of a component type; the type itself is used when absent. */
  readonly labelOf?: (type: string) => string | undefined;
  /**
   * The insertion gap under the pointer. The overlay is rebuilt on every store change, which drops
   * the CSS `:hover` of a replaced gap, so the hovered one is tracked here and drawn `hot`.
   */
  readonly hotGap?: { key: string | null; set: (key: string | null) => void };
}
export function drawAffordances(
  doc: Document,
  layer: HTMLElement,
  store: CanvasStore,
  view: View,
  onAction?: (action: Action) => void,
  onInsert?: (insert: Insert) => void,
  onHandleDown?: (event: PointerEvent) => void,
  geometry = measureGeometry(doc),
  extras: AffordanceExtras = {},
) {
  const win = doc.defaultView;
  const state = store.getState();
  if (!win || state.mode !== 'edit' || state.drop !== null) return;
  const button = (key: keyof typeof paths, click?: (event: MouseEvent) => void) => {
    const b = doc.createElement('button');
    b.type = 'button';
    b.dataset['control'] = key;
    b.setAttribute('data-focus-key', key);
    b.className = `tool ${key}`;
    const label = view.labels?.[key];
    if (label !== undefined) {
      b.setAttribute('aria-label', label);
      b.title = label;
    }
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = doc.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', paths[key]);
    svg.append(path);
    b.append(svg);
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      click?.(e);
    });
    return b;
  };
  const divider = () => {
    const el = doc.createElement('span');
    el.className = 'divider';
    el.setAttribute('aria-hidden', 'true');
    return el;
  };
  const id = state.selection[0];
  const selected = id ? geometry.get(id) : undefined;
  if (id && selected?.visible && id !== state.doc?.root) {
    const toolbar = doc.createElement('div');
    toolbar.className = 'toolbar';
    toolbar.setAttribute('role', 'toolbar');
    if (view.labels?.toolbar) toolbar.setAttribute('aria-label', view.labels.toolbar);
    const rect = selected.rect;
    const point = eventPoint;
    const emit = (action: Exclude<Action['action'], 'align'>) => (e: MouseEvent) =>
      onAction?.({ id, action, ...(action === 'more' ? { point: point(e) } : {}) });
    const parent = button('selectParent', emit('selectParent'));
    // Icon only: the parent's name is the accessible name and the tooltip (set as text, never HTML).
    const owner = Object.values(state.doc?.nodes ?? {}).find((node) =>
      Object.values(node.slots ?? {}).some((ids) => ids.includes(id)),
    );
    const ownerName = owner ? (owner.name ?? extras.labelOf?.(owner.type) ?? owner.type) : '';
    const template = view.labels?.selectParentOf;
    const parentLabel = ownerName
      ? template !== undefined
        ? template.split('{name}').join(ownerName)
        : ownerName
      : (view.labels?.selectParent ?? '');
    if (parentLabel) {
      parent.setAttribute('aria-label', parentLabel);
      parent.title = parentLabel;
    }
    toolbar.append(parent, divider());
    const drag = button('drag');
    drag.setAttribute('data-buildr-handle', '');
    if (onHandleDown) drag.addEventListener('pointerdown', onHandleDown);
    toolbar.append(drag);
    toolbar.append(button('moveUp', emit('moveUp')), button('moveDown', emit('moveDown')));
    const menu = doc.createElement('div');
    menu.className = 'align-menu';
    menu.hidden = true;
    const align = button('align', () => {
      menu.hidden = !menu.hidden;
      align.setAttribute('aria-expanded', String(!menu.hidden));
    });
    align.setAttribute('aria-haspopup', 'true');
    align.setAttribute('aria-expanded', 'false');
    for (const [key, value] of [
      ['alignLeft', 'left'],
      ['alignCenter', 'center'],
      ['alignRight', 'right'],
    ] as const) {
      menu.append(
        button(key, (e) => {
          onAction?.({ id, action: 'align', value, point: point(e) });
          menu.hidden = true;
          align.setAttribute('aria-expanded', 'false');
        }),
      );
    }
    toolbar.append(
      align,
      button('duplicate', emit('duplicate')),
      button('more', emit('more')),
      button('remove', emit('remove')),
      menu,
    );
    layer.append(toolbar);
    const scale = toolbarScale(view.scale);
    const place = placeToolbar(
      rect,
      win.innerWidth,
      toolbar.getBoundingClientRect().width,
      win.innerHeight,
      scale,
    );
    toolbar.style.left = `${place.left}px`;
    toolbar.style.top = `${place.top}px`;
    // Counter-scale: the host shrinks the whole frame, the toolbar undoes it (its top-left corner stays).
    if (scale !== 1) {
      toolbar.style.transformOrigin = '0 0';
      toolbar.style.transform = `scale(${1 / scale})`;
    }
  }
  let firstGap = true;
  for (const parent of Object.values(state.doc?.nodes ?? {})) {
    for (const [slot, ids] of Object.entries(parent.slots ?? {})) {
      for (let index = 0; index <= ids.length; index++) {
        const before = geometry.get(ids[index - 1] ?? '');
        const after = geometry.get(ids[index] ?? '');
        const container = geometry.get(parent.id);
        const a = before?.rect ?? after?.rect ?? container?.rect;
        const b = after?.rect ?? before?.rect ?? container?.rect;
        if (!a || !b) continue;
        const horizontal = !!before && !!after && b.left >= a.right && b.top < a.bottom;
        if (before && after && !horizontal && b.top < a.bottom) continue;
        const gap = doc.createElement('div');
        gap.className = 'insert-gap';
        const x = horizontal ? (a.right + b.left) / 2 : Math.max(a.left, b.left);
        const y = !before
          ? b.top
          : !after
            ? a.bottom
            : horizontal
              ? Math.max(a.top, b.top)
              : (a.bottom + b.top) / 2;
        gap.style.left = `${x}px`;
        gap.style.top = `${y - 8}px`;
        gap.style.width = `${horizontal ? 28 : Math.max(28, Math.min(a.right, b.right) - x)}px`;
        const target = { parentId: parent.id, slot, index };
        const insert = button('insert', (e) => onInsert?.({ target, point: eventPoint(e) }));
        insert.className = 'ins-btn';
        // One insertion stop per overlay; other gaps remain pointer reachable.
        insert.tabIndex = firstGap ? 0 : -1;
        firstGap = false;
        const gapKey = `insert:${parent.id}:${slot}:${index}`;
        insert.setAttribute('data-focus-key', gapKey);
        if (extras.hotGap?.key === gapKey) gap.classList.add('hot');
        gap.addEventListener('pointerenter', () => extras.hotGap?.set(gapKey));
        gap.addEventListener('pointerleave', () => extras.hotGap?.set(null));
        gap.append(insert);
        layer.append(gap);
      }
    }
  }
}
