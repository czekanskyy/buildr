import type { BuilderDocument, NodeId } from '@next-buildr/core';
import { createIndex, s } from '@next-buildr/core';
import {
  type CanvasMessage,
  type EditorMessage,
  MAX_PATCHES,
  type MessageType,
  type PayloadOf,
  PROTOCOL_VERSION,
  type Rejection,
  type Transport,
  TransportError,
} from '@next-buildr/core/protocol';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { BreakpointConfig } from '../app/config.ts';
import type { DocumentChange, EditorStore } from '../store/index.ts';
import { isNodeStructureLocked, structureLockedIds } from '../store/structure-lock.ts';

type Init = PayloadOf<'editor:init'>;
type Message<T extends MessageType> = PayloadOf<T>;

/** The store's document is the protocol's (it is checked against `documentSchema` at both ends); only the readonly modifiers differ. */
const wire = (doc: BuilderDocument) => doc as unknown as Init['doc'];

export type LocalesConfig = Init['locales'];
export type CanvasMode = Init['mode'];

/** How long the canvas has to answer with `canvas:hello` before the error screen shows. */
export const DEFAULT_HANDSHAKE_TIMEOUT_MS = 10_000;

/** How long a `ping` waits for its `pong` before the connection counts as lost. */
const PONG_TIMEOUT_MS = 15_000;

export type CanvasStatus =
  /** Waiting for the canvas to say hello. */
  | 'connecting'
  /** The canvas has its state and is rendering it. */
  | 'initializing'
  | 'ready'
  | 'error';

export type CanvasErrorKind =
  /** No `canvas:hello` in time: a wrong URL, a `frame-ancestors` CSP, an origin the canvas does not allow. */
  | 'timeout'
  /** The canvas was built with other components than the editor knows. */
  | 'manifest'
  /** The canvas speaks another protocol version. */
  | 'protocol'
  /** The canvas reported a fatal error. */
  | 'canvas';

export interface CanvasError {
  readonly kind: CanvasErrorKind;
  readonly message: string;
  /** What the peer reported, when it did (the versions, the hashes). */
  readonly details?: Readonly<Record<string, string | number>>;
}

export interface CanvasHostState {
  readonly status: CanvasStatus;
  readonly error: CanvasError | undefined;
  readonly breakpoint: string;
  readonly width: number;
  /** `'fit'` scales the canvas down to the room there is; a number is a scale. */
  readonly zoom: 'fit' | number;
  readonly locale: string;
  readonly contextRef: string | null;
  readonly mode: CanvasMode;
  /** What the canvas reported about the document (bindings, nodes that failed to render). */
  readonly diagnostics: Message<'diagnostics'>['items'];
  /** How many times the canvas has said hello: more than one means it reloaded. */
  readonly connections: number;
  readonly connectionLost: boolean;
}

export interface CanvasFrames {
  request(callback: () => void): unknown;
  cancel(handle: unknown): void;
}

export interface CanvasHostOptions {
  readonly store: EditorStore;
  /** The editor's end of the channel (`createParentTransport`); its `onReject` should be `host.handleReject`. */
  readonly transport: Transport<EditorMessage, CanvasMessage>;
  /** Of the registry the editor knows (`RegistryManifest.hash`); the canvas must have been built with the same one. */
  readonly manifestHash: string;
  readonly locales: LocalesConfig;
  readonly locale?: string;
  readonly breakpoints: readonly BreakpointConfig[];
  readonly breakpoint?: string;
  readonly contextRef?: string | null;
  readonly mode?: CanvasMode;
  readonly handshakeTimeoutMs?: number;
  /** Batches patches once per animation frame; `requestAnimationFrame` by default. */
  readonly frames?: CanvasFrames;
  readonly timers?: {
    setTimeout(callback: () => void, ms: number): unknown;
    clearTimeout(handle: unknown): void;
  };
  readonly onAction?: (event: Message<'intent:action'>) => void;
  readonly onInsert?: (event: Message<'intent:insert'>) => void;
  readonly onKeyDown?: (event: Message<'key:down'>) => void;
  readonly onContextMenu?: (event: Message<'contextmenu'>) => void;
  readonly onNodeDoubleClick?: (event: Message<'node:dblclick'>) => void;
  /** The canvas's answer to `dnd:over`. */
  readonly onDropTarget?: (event: Message<'dnd:target'>) => void;
  /** A command the canvas asked for was refused (an inline edit on a locked node, a move the rules forbid). */
  readonly onCommandError?: (error: { readonly code: string; readonly message: string }) => void;
  /** The canvas asked to remove, move or duplicate a block that is locked for structure (a layer "Lock"). */
  readonly onLocked?: (ids?: readonly NodeId[]) => void;
}

export interface CanvasHost {
  readonly state: StoreApi<CanvasHostState>;
  setView(view: Message<'view:set'>): void;
  setBreakpoint(id: string): void;
  setZoom(zoom: 'fit' | number): void;
  setLocale(locale: string): void;
  setContextRef(contextRef: string | null): void;
  setMode(mode: CanvasMode): void;
  /** Forwards a palette or tree drag over the canvas, in the canvas's own coordinates. */
  dndOver(point: { x: number; y: number }, item: Message<'dnd:over'>['item']): void;
  dndLeave(): void;
  scrollTo(id: NodeId): void;
  /** For the transport's `onReject`: a canvas of another protocol version is told apart from noise. */
  handleReject(rejection: Rejection): void;
  destroy(): void;
}

function defaultFrames(): CanvasFrames {
  const g = globalThis as unknown as {
    requestAnimationFrame?: (cb: () => void) => number;
    cancelAnimationFrame?: (handle: number) => void;
    setTimeout(cb: () => void, ms: number): unknown;
    clearTimeout(handle: unknown): void;
  };
  return g.requestAnimationFrame !== undefined
    ? {
        request: (cb) => g.requestAnimationFrame?.(cb),
        cancel: (h) => g.cancelAnimationFrame?.(h as number),
      }
    : { request: (cb) => g.setTimeout(cb, 16), cancel: (h) => g.clearTimeout(h) };
}

function defaultTimers(): NonNullable<CanvasHostOptions['timers']> {
  const g = globalThis as unknown as NonNullable<CanvasHostOptions['timers']>;
  return { setTimeout: (cb, ms) => g.setTimeout(cb, ms), clearTimeout: (h) => g.clearTimeout(h) };
}

/**
 * The editor's side of the canvas (docs/editor.md#the-postmessage-protocol). It answers every
 * `canvas:hello` with `editor:init` built from the store as it is then, so a canvas that reloads
 * loses nothing; it forwards the store's changes (patches batched once per animation frame,
 * selection and hover at once) and turns what the canvas reports into store actions. It holds
 * no document of its own: the store is the truth, and the canvas a replica that can always be
 * rebuilt with `doc:set`.
 */
export function createCanvasHost(options: CanvasHostOptions): CanvasHost {
  const { store, transport } = options;
  const frames = options.frames ?? defaultFrames();
  const timers = options.timers ?? defaultTimers();
  const timeoutMs = options.handshakeTimeoutMs ?? DEFAULT_HANDSHAKE_TIMEOUT_MS;

  const first = options.breakpoints[0];
  const chosen =
    options.breakpoints.find((b) => b.id === options.breakpoint) ??
    options.breakpoints.find((b) => b.id === 'desktop') ??
    first;
  if (chosen === undefined) throw new Error('at least one breakpoint is required');

  const state = createStore<CanvasHostState>(() => ({
    status: 'connecting',
    error: undefined,
    breakpoint: chosen.id,
    width: chosen.width,
    zoom: 'fit',
    locale: options.locale ?? options.locales.default,
    contextRef: options.contextRef ?? null,
    mode: options.mode ?? 'edit',
    diagnostics: [],
    connections: 0,
    connectionLost: false,
  }));

  const live = () => {
    const { status } = state.getState();
    return status === 'initializing' || status === 'ready';
  };

  // --- what goes to the canvas ---

  let queue: Extract<DocumentChange, { kind: 'patch' }>[] = [];
  let resend = false;
  let frame: unknown;

  const sendDocument = () => {
    const { doc, docVersion } = store.getState();
    transport.send('doc:set', { doc: wire(doc), docVersion });
  };

  const flush = () => {
    frame = undefined;
    const pending = queue;
    const whole = resend;
    queue = [];
    resend = false;
    if (!live()) return;
    if (whole) return sendDocument();
    const [head] = pending;
    const last = pending[pending.length - 1];
    if (head === undefined || last === undefined) return;
    const patches = pending.flatMap((change) => change.patches);
    if (patches.length > MAX_PATCHES) return sendDocument();
    transport.send('doc:patch', {
      from: head.from,
      to: last.to,
      patches: patches as PayloadOf<'doc:patch'>['patches'],
    });
  };

  const schedule = () => {
    if (frame === undefined) frame = frames.request(flush);
  };

  const offChange = store.onChange((change) => {
    if (!live()) return;
    if (change.kind === 'set') {
      queue = [];
      resend = true;
    } else queue.push(change);
    schedule();
  });

  let sentSelection = store.getState().selectedIds;
  let sentHover = store.getState().hoveredId;
  const offState = store.subscribe((next) => {
    if (next.selectedIds !== sentSelection) {
      sentSelection = next.selectedIds;
      if (live()) transport.send('selection:set', { ids: [...next.selectedIds] });
    }
    if (next.hoveredId !== sentHover) {
      sentHover = next.hoveredId;
      if (live()) transport.send('hover:set', { id: next.hoveredId });
    }
  });

  let view: Message<'view:set'> = {};
  const init = () => {
    const host = state.getState();
    const { doc, docVersion, selectedIds } = store.getState();
    queue = [];
    resend = false;
    sentSelection = selectedIds;
    sentHover = null;
    transport.send('editor:init', {
      doc: wire(doc),
      docVersion,
      selection: [...selectedIds],
      viewport: { breakpoint: host.breakpoint, width: host.width },
      contextRef: host.contextRef,
      locale: host.locale,
      locales: options.locales,
      mode: host.mode,
    });
    transport.send('view:set', view);
  };

  // --- the handshake ---

  let handshake: unknown;
  const fail = (error: CanvasError) => state.setState({ status: 'error', error });

  handshake = timers.setTimeout(() => {
    if (state.getState().connections === 0) {
      fail({
        kind: 'timeout',
        message:
          'the canvas did not answer: check its URL, its Content-Security-Policy (frame-ancestors) and the origins it allows',
      });
    }
  }, timeoutMs);

  // The heartbeat (docs/editor.md#the-postmessage-protocol): a `ping` is a request, so the canvas
  // answers it with `reply`, which names the ping's id, and only the transport's request path
  // reads such an answer (a `pong` that answers nothing is dropped as a stale reply). At most one
  // ping is outstanding; `epoch` makes the answer to a ping of an earlier session count for nothing.
  let heartbeat: unknown;
  let outstanding = false;
  let epoch = 0;
  const stopHeartbeat = () => {
    timers.clearTimeout(heartbeat);
    heartbeat = undefined;
    outstanding = false;
    epoch += 1;
  };
  const ping = () => {
    if (!live()) return;
    heartbeat = timers.setTimeout(ping, 5_000);
    if (outstanding) return;
    outstanding = true;
    const mine = epoch;
    transport.request('ping', {}, { timeoutMs: PONG_TIMEOUT_MS }).then(
      (answer) => {
        if (mine !== epoch) return;
        outstanding = false;
        if (answer.type === 'pong') state.setState({ connectionLost: false });
      },
      (error: unknown) => {
        if (mine !== epoch) return;
        outstanding = false;
        if (error instanceof TransportError && error.code === 'timeout' && live()) {
          state.setState({ connectionLost: true });
        }
      },
    );
  };
  const allowed = (id: NodeId, aspect: 'structure' | 'style') => {
    const { doc, readOnly } = store.getState();
    if (!live() || readOnly || !Object.hasOwn(doc.nodes, id)) return false;
    const index = createIndex(doc);
    let current: NodeId | undefined = id;
    let region = false;
    while (current !== undefined) {
      const node = doc.nodes[current];
      if (node?.lock?.[aspect]) return region;
      if (node?.region !== undefined) region = true;
      current = index.parentOf[current];
    }
    return true;
  };

  const offs = [
    transport.on('canvas:hello', (payload) => {
      timers.clearTimeout(handshake);
      stopHeartbeat();
      // A hello at any time (a canvas that reloaded, or one that never lost its state but found a
      // new editor) starts the session over: nothing queued for the old one is sent to the new.
      if (frame !== undefined) {
        frames.cancel(frame);
        frame = undefined;
      }
      queue = [];
      resend = false;
      const { protocol, rendererVersion, manifestHash } = payload;
      state.setState((s0) => ({ connections: s0.connections + 1, diagnostics: [] }));
      if (protocol !== PROTOCOL_VERSION) {
        return fail({
          kind: 'protocol',
          message: 'the canvas speaks another protocol version',
          details: { editor: PROTOCOL_VERSION, canvas: protocol },
        });
      }
      if (manifestHash !== options.manifestHash) {
        return fail({
          kind: 'manifest',
          message: 'the canvas was built with other components than the editor knows',
          details: { editor: options.manifestHash, canvas: manifestHash, rendererVersion },
        });
      }
      state.setState({ status: 'initializing', error: undefined, connectionLost: false });
      init();
    }),
    transport.on('canvas:ready', () => {
      if (state.getState().status === 'initializing') {
        state.setState({ status: 'ready' });
        ping();
      }
    }),
    transport.on('doc:resync-request', () => {
      if (!live()) return;
      queue = [];
      resend = false;
      sendDocument();
    }),
    transport.on('node:click', (payload) => {
      const { modifiers, id, instance } = payload;
      const mode = modifiers.shift
        ? 'add'
        : modifiers.ctrl || modifiers.meta
          ? 'toggle'
          : 'replace';
      store.select(id, { mode, ...(instance !== undefined ? { instance } : {}) });
    }),
    transport.on('node:hover', (payload) => store.setHovered(payload.id)),
    transport.on('node:dblclick', (payload) => options.onNodeDoubleClick?.(payload)),
    transport.on('inline:commit', (payload) => {
      const { locale, locales } = { locale: state.getState().locale, locales: options.locales };
      const result = store.dispatch(
        {
          type: 'node.setProp',
          payload: {
            id: payload.id,
            prop: payload.prop,
            value: s(payload.value),
            ...(locale !== locales.default ? { locale } : {}),
          },
        },
        { label: 'inline-edit' },
      );
      if (!result.ok) options.onCommandError?.(result.error);
    }),
    transport.on('intent:move', (payload) => {
      // Core checks the lock from the parent on; a locked block itself is not moved by the canvas either.
      if (structureLockedIds(store.getState().doc, payload.ids).length > 0) {
        options.onLocked?.(payload.ids);
        return;
      }
      const result = store.dispatch({
        type: 'node.move',
        payload: {
          ids: payload.ids,
          parentId: payload.target.parentId,
          slot: payload.target.slot,
          index: payload.target.index,
        },
      });
      if (!result.ok) options.onCommandError?.(result.error);
    }),
    transport.on('intent:action', (payload) => {
      const { doc } = store.getState();
      if (!live() || !Object.hasOwn(doc.nodes, payload.id)) return;
      const changesStructure =
        payload.action === 'remove' ||
        payload.action === 'duplicate' ||
        payload.action === 'moveUp' ||
        payload.action === 'moveDown';
      if (changesStructure && payload.id !== doc.root && isNodeStructureLocked(doc, payload.id)) {
        options.onLocked?.([payload.id]);
        return;
      }
      if (
        payload.action !== 'selectParent' &&
        (!allowed(payload.id, payload.action === 'align' ? 'style' : 'structure') ||
          payload.id === doc.root)
      )
        return;
      options.onAction?.(payload);
    }),
    transport.on('intent:insert', (payload) => {
      const { parentId, slot, index } = payload.target;
      const { doc } = store.getState();
      if (!allowed(parentId, 'structure')) return;
      const children = doc.nodes[parentId]?.slots?.[slot];
      const meta = store.registry.get(doc.nodes[parentId]?.type ?? '');
      if (children === undefined && meta?.slots?.[slot] === undefined) return;
      if (index > (children?.length ?? 0)) return;
      options.onInsert?.(payload);
    }),
    transport.on('dnd:target', (payload) => options.onDropTarget?.(payload)),
    transport.on('key:down', (payload) => options.onKeyDown?.(payload)),
    transport.on('contextmenu', (payload) => options.onContextMenu?.(payload)),
    transport.on('diagnostics', (payload) => state.setState({ diagnostics: payload.items })),
    transport.on('canvas:error', (payload) => {
      if (payload.fatal) fail({ kind: 'canvas', message: payload.message });
    }),
  ];

  const sendViewport = () => {
    const { breakpoint, width } = state.getState();
    if (live()) transport.send('viewport:set', { breakpoint, width });
  };

  return {
    state,
    setView(next) {
      view = { ...view, ...next, labels: { ...view.labels, ...next.labels } };
      if (live()) transport.send('view:set', view);
    },
    setBreakpoint(id) {
      const found = options.breakpoints.find((b) => b.id === id);
      if (found === undefined) return;
      state.setState({ breakpoint: found.id, width: found.width });
      sendViewport();
    },
    setZoom: (zoom) => state.setState({ zoom }),
    setLocale(locale) {
      if (!options.locales.locales.includes(locale)) return;
      state.setState({ locale });
      if (live()) transport.send('locale:set', { locale });
    },
    setContextRef(contextRef) {
      state.setState({ contextRef });
      if (live()) transport.send('context:set', { contextRef });
    },
    setMode(mode) {
      state.setState({ mode });
      if (live()) transport.send('mode:set', { mode });
    },
    dndOver: (point, item) => {
      if (live()) transport.send('dnd:over', { point, item });
    },
    dndLeave: () => {
      if (live()) transport.send('dnd:leave', {});
    },
    scrollTo: (id) => {
      if (live()) transport.send('scroll:to', { id });
    },
    handleReject(rejection) {
      if (rejection.reason !== 'version' || state.getState().status === 'error') return;
      timers.clearTimeout(handshake);
      fail({
        kind: 'protocol',
        message: 'the canvas speaks another protocol version',
        details: {
          editor: PROTOCOL_VERSION,
          ...(rejection.protocol !== undefined ? { canvas: rejection.protocol } : {}),
        },
      });
    },
    destroy() {
      stopHeartbeat();
      timers.clearTimeout(handshake);
      if (frame !== undefined) frames.cancel(frame);
      offChange();
      offState();
      for (const off of offs) off();
      transport.close();
    },
  };
}
