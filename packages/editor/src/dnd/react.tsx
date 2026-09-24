import type { DragItem } from '@buildr/core';
import {
  createContext,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import { useStore } from 'zustand';
import { useT } from '../messages/index.tsx';
import { useEditor } from '../store/index.ts';
import {
  type CanvasSurface,
  createDragEngine,
  type DragEngine,
  type DragHost,
  type DragState,
  IDLE_STATE,
  type TreeSurface,
} from './engine.ts';
import { autoscrollDelta } from './geometry.ts';

const IDLE_STORE = { getState: () => IDLE_STATE };

interface Registry {
  canvas: (() => CanvasSurface | undefined) | null;
  tree: (() => TreeSurface | undefined) | null;
  host: DragHost | null;
}

interface DragContextValue {
  readonly engine: DragEngine;
  readonly registry: Registry;
}

const DragContext = createContext<DragContextValue | null>(null);

function useDragContext(): DragContextValue {
  const value = useContext(DragContext);
  if (value === null) throw new Error('DragProvider is missing');
  return value;
}

/** Panels work without a provider (no dragging, no indicators): tests and embeds that do not need it. */
const useOptionalDrag = (): DragContextValue | null => useContext(DragContext);

const noSubscription = () => () => undefined;

/** The engine, for what wires it (`receiveTarget` from the canvas' `dnd:target`, "Move to…"). */
export function useDragEngine(): DragEngine {
  return useDragContext().engine;
}

/** The drag as it stands, for indicators; only what `select` returns causes a render. */
export function useDragState<T>(select: (state: DragState) => T): T {
  const drag = useOptionalDrag();
  return useSyncExternalStore(
    drag === null ? noSubscription : drag.engine.state.subscribe,
    () => select((drag?.engine.state ?? IDLE_STORE).getState()),
    () => select(IDLE_STATE),
  );
}

/** The canvas hands over where its frame is (window coordinates) and how far it is zoomed. */
export function useRegisterCanvas(surface: () => CanvasSurface | undefined): void {
  const { registry } = useDragContext();
  const ref = useRef(surface);
  ref.current = surface;
  useEffect(() => {
    registry.canvas = () => ref.current();
    return () => {
      registry.canvas = null;
    };
  }, [registry]);
}

/** The layers tree hands over its viewport, scroll position and rows. */
export function useRegisterTree(surface: () => TreeSurface | undefined): void {
  const registry = useOptionalDrag()?.registry;
  const ref = useRef(surface);
  ref.current = surface;
  useEffect(() => {
    if (registry === undefined) return;
    registry.tree = () => ref.current();
    return () => {
      registry.tree = null;
    };
  }, [registry]);
}

/** The canvas host the drag forwards to; `null` while there is none. */
export function useRegisterDragHost(host: DragHost | null): void {
  const { registry } = useDragContext();
  useEffect(() => {
    registry.host = host;
    return () => {
      registry.host = null;
    };
  }, [registry, host]);
}

export interface DragProviderProps {
  readonly children: ReactNode;
}

/**
 * Owns the engine of an editor, listens to the pointer and Escape while something is dragged, puts
 * a shield over the page (the canvas iframe would otherwise swallow the pointer events), and draws
 * the ghost that follows the pointer. What it says for the screen reader is a live region.
 */
export function DragProvider({ children }: DragProviderProps) {
  const store = useEditor();
  const value = useMemo<DragContextValue>(() => {
    const registry: Registry = { canvas: null, tree: null, host: null };
    const engine = createDragEngine({
      store,
      host: () => registry.host ?? undefined,
      surfaces: { canvas: () => registry.canvas?.(), tree: () => registry.tree?.() },
    });
    return { engine, registry };
  }, [store]);
  const { engine } = value;
  const phase = useStore(engine.state, (s) => s.phase);

  useEffect(() => {
    if (phase === 'idle') return;
    const move = (event: PointerEvent) => engine.move({ x: event.clientX, y: event.clientY });
    const up = () => {
      engine.release();
    };
    const cancel = () => engine.cancel();
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      engine.cancel();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('keydown', key, true);
    };
  }, [engine, phase]);

  useEffect(() => () => engine.dispose(), [engine]);

  return (
    <DragContext.Provider value={value}>
      {children}
      <DragOverlay engine={engine} />
    </DragContext.Provider>
  );
}

function DragOverlay({ engine }: { readonly engine: DragEngine }) {
  const t = useT();
  const state = useStore(engine.state);
  const dragging = state.phase === 'dragging';
  return (
    <>
      {dragging ? (
        <div className="bd-drag-shield" data-over={state.over ?? 'none'} aria-hidden="true" />
      ) : null}
      {dragging && state.pointer !== null ? (
        <div
          className="bd-drag-ghost"
          aria-hidden="true"
          data-allowed={state.target !== null}
          style={{ transform: `translate(${state.pointer.x + 12}px, ${state.pointer.y + 12}px)` }}
        >
          {state.label}
        </div>
      ) : null}
      <div className="bd-drag-live" role="status" aria-live="polite">
        {dragging && state.over !== null && state.target === null
          ? `${t('dnd.notAllowed')} ${state.reason?.message ?? ''}`.trim()
          : ''}
      </div>
    </>
  );
}

export interface DragSourceProps {
  readonly onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
}

/**
 * Props that make an element start a drag on primary-button press. `item` may be a function, so a
 * tree row can decide at press time (the whole selection or just this row).
 */
export function useDragSource(item: DragItem | (() => DragItem), label: string | (() => string)) {
  const engine = useOptionalDrag()?.engine;
  const latest = useRef({ item, label });
  latest.current = { item, label };
  return useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (engine === undefined || event.button !== 0 || !event.isPrimary) return;
      const current = latest.current;
      const resolved = typeof current.item === 'function' ? current.item() : current.item;
      const text = typeof current.label === 'function' ? current.label() : current.label;
      engine.press(resolved, text, { x: event.clientX, y: event.clientY });
    },
    [engine],
  );
}

/** Whether a `DragProvider` is above: panels offer dragging and "Move to" only then. */
export function useDragAvailable(): boolean {
  return useOptionalDrag() !== null;
}

/**
 * Starts a drag from a pointer event of something that decides at press time what is dragged (a row
 * of the layers tree); `undefined` without a provider.
 */
export function useDragPress():
  | ((item: DragItem, label: string, event: ReactPointerEvent<HTMLElement>) => void)
  | undefined {
  const engine = useOptionalDrag()?.engine;
  return useMemo(
    () =>
      engine === undefined
        ? undefined
        : (item, label, event) => {
            if (event.button !== 0 || !event.isPrimary) return;
            engine.press(item, label, { x: event.clientX, y: event.clientY });
          },
    [engine],
  );
}

/**
 * While something is dragged over `element`, scrolls it when the pointer is near its top or bottom
 * edge, once per animation frame, and re-hovers so the target follows what scrolled under the pointer.
 */
export function useDragAutoscroll(element: RefObject<HTMLElement | null>): void {
  const engine = useOptionalDrag()?.engine;
  const active = useDragState((state) => state.phase === 'dragging' && state.over === 'tree');
  useEffect(() => {
    if (engine === undefined || !active) return;
    let handle = 0;
    const tick = () => {
      const target = element.current;
      const pointer = engine.state.getState().pointer;
      if (target !== null && pointer !== null) {
        const box = target.getBoundingClientRect();
        const delta = autoscrollDelta(
          { left: box.left, top: box.top, width: box.width, height: box.height },
          pointer.y,
        );
        if (delta !== 0) {
          const before = target.scrollTop;
          target.scrollTop = before + delta;
          if (target.scrollTop !== before) engine.move(pointer);
        }
      }
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [engine, active, element]);
}
