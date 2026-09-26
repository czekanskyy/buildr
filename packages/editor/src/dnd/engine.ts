import type { DragItem, DropTarget, Reason } from '@next-buildr/core';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { LayerRow } from '../panels/layers/flatten.ts';
import type { EditorStore } from '../store/index.ts';
import { fragmentFor } from './fragment.ts';
import { type Point, type Rect, rectContains, toCanvasPoint } from './geometry.ts';
import { type TreeDropResult, treeDropTarget } from './tree-target.ts';

/** The pointer moves this far (pixels) before a press becomes a drag: a click stays a click. */
export const DRAG_THRESHOLD = 4;

/** The part of the canvas host a drag talks to. */
export interface DragHost {
  dndOver(point: Point, item: DragItem): void;
  dndLeave(): void;
}

/** The canvas as the pointer sees it: where its frame is in the window and how far it is zoomed. */
export interface CanvasSurface {
  readonly frame: Rect;
  readonly scale: number;
}

/** The layers tree as the pointer sees it. */
export interface TreeSurface {
  /** The scrolling viewport of the list, in window coordinates. */
  readonly viewport: Rect;
  readonly scrollTop: number;
  readonly rows: readonly LayerRow[];
  readonly rowHeight: number;
}

export interface DragSurfaces {
  canvas(): CanvasSurface | undefined;
  tree(): TreeSurface | undefined;
}

export type DragPhase = 'idle' | 'pending' | 'dragging';
export type DragOver = 'canvas' | 'tree' | null;

export interface DragState {
  readonly phase: DragPhase;
  readonly item: DragItem | null;
  /** What the ghost says (a component's name, the number of nodes). */
  readonly label: string;
  readonly pointer: Point | null;
  readonly over: DragOver;
  /** The gap the item would land in, or `null` where it may not be dropped. */
  readonly target: DropTarget | null;
  readonly reason: Reason | null;
  /** Set while over the tree: which row and side the indicator is drawn on. */
  readonly tree: Pick<TreeDropResult, 'rowIndex' | 'position'> | null;
  /** The message of the last drop the commands refused. */
  readonly error: string | null;
}

export interface DragEngineOptions {
  readonly store: EditorStore;
  readonly host: () => DragHost | undefined;
  readonly surfaces: DragSurfaces;
  readonly raf?: (callback: () => void) => number;
  readonly caf?: (handle: number) => void;
}

export interface DragEngine {
  readonly state: StoreApi<DragState>;
  /** A pointer went down on something draggable; nothing happens until it moves. */
  press(item: DragItem, label: string, at: Point): void;
  move(at: Point): void;
  /** The pointer went up: drops where the drag stands. Returns whether something was dropped. */
  release(): boolean;
  cancel(): void;
  /** The canvas answered a `dnd:over` (protocol `dnd:target`). */
  receiveTarget(target: DropTarget | null, reason?: Reason): void;
  /** Applies a drop directly (the "Move to…" dialog and the keyboard use it). */
  drop(item: DragItem, target: DropTarget): { ok: true } | { ok: false; message: string };
  dispose(): void;
}

export const IDLE_STATE: DragState = {
  phase: 'idle',
  item: null,
  label: '',
  pointer: null,
  over: null,
  target: null,
  reason: null,
  tree: null,
  error: null,
};

/**
 * The drag-and-drop engine (docs/editor.md#drag-and-drop-pb-086), free of React: a small state
 * machine (idle → pending → dragging), a hit-test of the pointer against the two drop surfaces, and
 * the drop itself. Over the canvas the pointer is translated into the canvas' coordinates (the frame
 * offset and the zoom) and forwarded once per animation frame; the canvas answers with the target
 * (`dnd:target`, computed by `computeDropTarget` where the layout is). Over the tree the target comes
 * from `treeDropTarget` right here. A drop always goes through the commands, `node.insert` or
 * `node.move`, which check the rules again, so a stale or hostile target can do no harm.
 */
export function createDragEngine(options: DragEngineOptions): DragEngine {
  const { store, surfaces } = options;
  const raf = options.raf ?? ((cb) => requestAnimationFrame(cb));
  const caf = options.caf ?? ((handle) => cancelAnimationFrame(handle));
  const state = createStore<DragState>(() => IDLE_STATE);
  let origin: Point | null = null;
  let frame: number | null = null;
  let pendingOver: { point: Point; item: DragItem } | null = null;
  let forwarding = false;

  const set = (patch: Partial<DragState>) => state.setState(patch);

  function stopForwarding() {
    if (frame !== null) {
      caf(frame);
      frame = null;
    }
    pendingOver = null;
    if (forwarding) {
      forwarding = false;
      options.host()?.dndLeave();
    }
  }

  function reset() {
    stopForwarding();
    origin = null;
    state.setState(IDLE_STATE, true);
  }

  function forward(point: Point, item: DragItem) {
    pendingOver = { point, item };
    forwarding = true;
    if (frame !== null) return;
    frame = raf(() => {
      frame = null;
      const next = pendingOver;
      pendingOver = null;
      if (next !== null) options.host()?.dndOver(next.point, next.item);
    });
  }

  function hover(at: Point) {
    const current = state.getState();
    const item = current.item;
    if (item === null) return;
    const canvas = surfaces.canvas();
    if (canvas !== undefined && rectContains(canvas.frame, at)) {
      const point = toCanvasPoint(at, canvas.frame, canvas.scale);
      if (point !== undefined) {
        // The canvas decides the target; what was there stays until it answers.
        forward(point, item);
        set({
          pointer: at,
          over: 'canvas',
          tree: null,
          ...(current.over === 'canvas' ? {} : { target: null, reason: null }),
        });
        return;
      }
    }
    const tree = surfaces.tree();
    if (tree !== undefined && rectContains(tree.viewport, at)) {
      if (forwarding) {
        stopForwarding();
      }
      const { doc } = store.getState();
      const result = treeDropTarget({
        doc,
        registry: store.registry,
        rows: tree.rows,
        item,
        y: at.y - tree.viewport.top + tree.scrollTop,
        rowHeight: tree.rowHeight,
      });
      set({
        pointer: at,
        over: 'tree',
        target: result?.target ?? null,
        reason: result?.reason ?? null,
        tree:
          result === undefined ? null : { rowIndex: result.rowIndex, position: result.position },
      });
      return;
    }
    stopForwarding();
    set({ pointer: at, over: null, target: null, reason: null, tree: null });
  }

  function drop(item: DragItem, target: DropTarget): { ok: true } | { ok: false; message: string } {
    const snapshot = store.getState();
    if (snapshot.readOnly) return { ok: false, message: 'readOnly' };
    if (item.kind === 'nodes') {
      const ids = item.ids.filter(
        (id) => id !== snapshot.doc.root && Object.hasOwn(snapshot.doc.nodes, id),
      );
      if (ids.length === 0) return { ok: false, message: 'nothingToMove' };
      const result = store.dispatch({ type: 'node.move', payload: { ids, ...target } });
      return result.ok ? { ok: true } : { ok: false, message: result.error.message };
    }
    const fragment = fragmentFor(store.registry, item);
    if (fragment === undefined) return { ok: false, message: 'unknownItem' };
    const result = store.dispatch({ type: 'node.insert', payload: { ...target, fragment } });
    if (!result.ok) return { ok: false, message: result.error.message };
    // The command gives the fragment fresh ids; the new node is the one now at the target position.
    const created =
      store.getState().doc.nodes[target.parentId]?.slots?.[target.slot]?.[target.index];
    if (created !== undefined) store.select(created);
    return { ok: true };
  }

  return {
    state,
    press(item, label, at) {
      reset();
      origin = at;
      state.setState({ ...IDLE_STATE, phase: 'pending', item, label, pointer: at }, true);
    },
    move(at) {
      const current = state.getState();
      if (current.phase === 'idle' || origin === null) return;
      if (current.phase === 'pending') {
        if (Math.hypot(at.x - origin.x, at.y - origin.y) < DRAG_THRESHOLD) return;
        set({ phase: 'dragging' });
      }
      hover(at);
    },
    release() {
      const current = state.getState();
      const { item, target, phase } = current;
      if (phase !== 'dragging' || item === null) {
        reset();
        return false;
      }
      // A drop is applied before the canvas is told the drag is over.
      let dropped = false;
      let error: string | null = null;
      if (target !== null) {
        const result = drop(item, target);
        dropped = result.ok;
        if (!result.ok) error = result.message;
      }
      reset();
      if (error !== null) set({ error });
      return dropped;
    },
    cancel: reset,
    receiveTarget(target, reason) {
      // Answers that arrive after the drag ended or while over the tree are stale.
      const current = state.getState();
      if (current.phase !== 'dragging' || current.over !== 'canvas') return;
      set({ target, reason: reason === undefined ? null : (reason as Reason) });
    },
    drop,
    dispose: reset,
  };
}
