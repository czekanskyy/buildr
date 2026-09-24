import {
  computeDropTarget,
  type DragItem,
  type NodeId,
  type Point,
  type RegistryMeta,
} from '@buildr/core';
import type { CanvasStore, DropView } from '../store.ts';
import type { CanvasTransport } from '../types.ts';
import { buildHitPath } from './hit-path.ts';

export interface DndOptions {
  readonly document: Document;
  readonly store: CanvasStore;
  readonly transport: () => CanvasTransport | null;
  readonly registry: () => RegistryMeta;
}

export interface DndController {
  /** `dnd:over`: an item from the editor is over the canvas at `point`. */
  over(point: Point, item: DragItem): void;
  /** `dnd:leave`: it left, or was dropped. */
  leave(): void;
  /** The pointer went down on the overlay's drag handle: move the selection inside the canvas. */
  beginMove(event: PointerEvent): void;
  destroy(): void;
}

/** How near the edge of the window autoscroll starts, and how fast it goes, in pixels. */
const EDGE = 48;
const SPEED = 14;

interface Outcome {
  readonly target: {
    readonly parentId: NodeId;
    readonly slot: string;
    readonly index: number;
  } | null;
  readonly view: DropView | null;
  readonly reason?: { code: string; message: string; params?: Record<string, never> };
}

/**
 * Drag and drop inside the canvas (docs/drag-and-drop.md). It hit-tests the page under a point,
 * asks `computeDropTarget` where the item may land and draws the indicator; for an item dragged in
 * from the editor it also answers with `dnd:target`, and for a node moved with the overlay's handle
 * it captures the pointer, autoscrolls near the edges and sends `intent:move` on drop.
 */
export function createDndController(options: DndOptions): DndController {
  const { document: doc, store } = options;
  const win = doc.defaultView;
  let lastReport = '';
  let moving:
    | { ids: readonly NodeId[]; point: Point; frame: number | undefined; outcome: Outcome }
    | undefined;

  const evaluate = (point: Point, item: DragItem): Outcome => {
    const document_ = store.getState().doc;
    if (document_ === undefined) return { target: null, view: null };
    const hitPath = buildHitPath(doc, point, store);
    if (hitPath.length === 0) return { target: null, view: null };
    const result = computeDropTarget({
      point,
      hitPath,
      doc: document_,
      registry: options.registry(),
      item,
    });
    if (result.target !== null) {
      return {
        target: result.target,
        view:
          result.indicator === undefined
            ? null
            : { kind: result.indicator.kind, rect: result.indicator.rect },
      };
    }
    const first = hitPath[0];
    return {
      target: null,
      view: {
        kind: 'forbidden',
        rect: first?.rect ?? { x: point.x, y: point.y, width: 0, height: 0 },
        ...(result.reason !== undefined ? { message: result.reason.message } : {}),
      },
      ...(result.reason !== undefined
        ? {
            reason: {
              code: result.reason.code,
              message: result.reason.message.slice(0, 500),
              ...(result.reason.params !== undefined
                ? { params: result.reason.params as never }
                : {}),
            },
          }
        : {}),
    };
  };

  const show = (view: DropView | null) => {
    const current = store.getState().drop;
    if (JSON.stringify(current) !== JSON.stringify(view)) store.update({ drop: view });
  };

  const over = (point: Point, item: DragItem) => {
    if (store.getState().mode !== 'edit') return;
    const outcome = evaluate(point, item);
    show(outcome.view);
    // One answer per change: the editor sends `dnd:over` every frame.
    const payload = {
      target: outcome.target,
      ...(outcome.reason !== undefined ? { reason: outcome.reason } : {}),
    };
    const json = JSON.stringify(payload);
    if (json === lastReport) return;
    lastReport = json;
    options.transport()?.send('dnd:target', payload as never);
  };

  const leave = () => {
    lastReport = '';
    show(null);
  };

  // --- Moving a node inside the canvas ---------------------------------------------------------

  const step = () => {
    const drag = moving;
    if (drag === undefined || win === null) return;
    drag.frame = undefined;
    const { y } = drag.point;
    const dy = y < EDGE ? -SPEED : y > win.innerHeight - EDGE ? SPEED : 0;
    if (dy !== 0) {
      win.scrollBy(0, dy);
      moveTo(drag.point);
    }
    drag.frame = win.requestAnimationFrame(step);
  };

  const moveTo = (point: Point) => {
    const drag = moving;
    if (drag === undefined) return;
    drag.point = point;
    drag.outcome = evaluate(point, { kind: 'nodes', ids: drag.ids });
    show(drag.outcome.view);
  };

  const finish = (drop: boolean) => {
    const drag = moving;
    if (drag === undefined) return;
    moving = undefined;
    if (drag.frame !== undefined) win?.cancelAnimationFrame(drag.frame);
    doc.removeEventListener('pointermove', onMove, true);
    doc.removeEventListener('pointerup', onUp, true);
    doc.removeEventListener('pointercancel', onCancel, true);
    doc.removeEventListener('keydown', onKey, true);
    show(null);
    if (drop && drag.outcome.target !== null) {
      options.transport()?.send('intent:move', { ids: [...drag.ids], target: drag.outcome.target });
    }
  };

  function onMove(event: PointerEvent) {
    event.preventDefault();
    moveTo({ x: event.clientX, y: event.clientY });
  }
  function onUp(event: PointerEvent) {
    event.preventDefault();
    moveTo({ x: event.clientX, y: event.clientY });
    finish(true);
  }
  function onCancel() {
    finish(false);
  }
  function onKey(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    finish(false);
  }

  const beginMove = (event: PointerEvent) => {
    const state = store.getState();
    if (state.mode !== 'edit' || moving !== undefined || state.doc === undefined) return;
    const root = state.doc.root;
    const ids = state.selection.filter((id) => id !== root && store.getNode(id) !== undefined);
    if (ids.length === 0) return;
    event.preventDefault();
    const point = { x: event.clientX, y: event.clientY };
    moving = { ids, point, frame: undefined, outcome: { target: null, view: null } };
    try {
      doc.documentElement.setPointerCapture(event.pointerId);
    } catch {
      // A synthetic or already-released pointer: the document listeners still work inside the frame.
    }
    doc.addEventListener('pointermove', onMove, true);
    doc.addEventListener('pointerup', onUp, true);
    doc.addEventListener('pointercancel', onCancel, true);
    doc.addEventListener('keydown', onKey, true);
    moveTo(point);
    moving.frame = win?.requestAnimationFrame(step);
  };

  return {
    over,
    leave,
    beginMove,
    destroy: () => {
      finish(false);
      leave();
    },
  };
}
