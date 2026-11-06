import {
  type BuilderDocument,
  type ComponentMeta,
  createRegistryMeta,
  createSeededIdGenerator,
  p,
  s,
} from '@next-buildr/core';
import {
  type CanvasMessage,
  createChildTransport,
  createParentTransport,
  type EditorMessage,
  type MessageEventLike,
  type PostTarget,
  PROTOCOL_VERSION,
  type Rejection,
  type Transport,
  type WindowLike,
} from '@next-buildr/core/protocol';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_BREAKPOINTS } from '../app/config.ts';
import { createEditorStore } from '../store/index.ts';
import { type CanvasFrames, type CanvasHostOptions, createCanvasHost } from './host.ts';

const SESSION = 'abcDEF0123456789_-xyz';
const EDITOR = 'https://editor.example.com';
const CANVAS = 'https://canvas.example.com';
const HASH = 'manifest-hash';
const mods = { shift: false, alt: false, ctrl: false, meta: false };

type Listener = (event: MessageEventLike) => void;

/** A window with an origin: posting to it delivers to its own listeners, from the peer. */
class FakeWindow implements WindowLike {
  readonly listeners = new Set<Listener>();
  peer: FakeWindow | undefined;
  readonly handle: PostTarget = {
    postMessage: (message, targetOrigin) => {
      if (targetOrigin !== this.origin || this.peer === undefined) return;
      const event = {
        data: structuredClone(message),
        origin: this.peer.origin,
        source: this.peer.handle,
      };
      for (const listener of [...this.listeners]) listener(event);
    },
  };
  constructor(readonly origin: string) {}
  addEventListener(_type: 'message', listener: Listener) {
    this.listeners.add(listener);
  }
  removeEventListener(_type: 'message', listener: Listener) {
    this.listeners.delete(listener);
  }
}

const node = (id: string, type: string, extra: Record<string, unknown> = {}) => ({
  id,
  type,
  ...extra,
});

const fixture = (): BuilderDocument => ({
  schemaVersion: 1,
  root: 'root',
  nodes: {
    root: node('root', 'buildr/page', { slots: { default: ['boxNode001'] } }),
    boxNode001: node('boxNode001', 'buildr/box', {
      slots: { default: ['textNodeA1', 'textNodeB1'] },
    }),
    textNodeA1: node('textNodeA1', 'buildr/text', { props: { text: s('A') } }),
    textNodeB1: node('textNodeB1', 'buildr/text', { props: { text: s('B') } }),
  },
  components: {},
});

const meta = (type: string, overrides: Partial<ComponentMeta> = {}): ComponentMeta => ({
  type,
  version: 1,
  label: type,
  category: 'content',
  props: {},
  contentCategories: ['flow'],
  styles: { groups: [] },
  runtime: 'shared',
  ...overrides,
});

const registry = createRegistryMeta({
  components: [
    meta('buildr/page', { capabilities: { root: true }, slots: { default: {} } }),
    meta('buildr/box', { slots: { default: {} } }),
    meta('buildr/text', { props: { text: p.text({ default: '' }) } }),
  ],
});

const locales = { locales: ['en', 'pl'], default: 'en', fallback: true, intl: {} };

/** Frames that run when the test says so. */
function manualFrames() {
  const callbacks: (() => void)[] = [];
  const frames: CanvasFrames = {
    request: (cb) => callbacks.push(cb),
    cancel: () => {},
  };
  return {
    frames,
    pending: () => callbacks.length,
    run() {
      for (const cb of callbacks.splice(0)) cb();
    },
  };
}

function manualTimers() {
  const tasks = new Map<number, () => void>();
  let next = 1;
  return {
    timers: {
      setTimeout: (cb: () => void) => {
        tasks.set(next, cb);
        return next++;
      },
      clearTimeout: (handle: unknown) => void tasks.delete(handle as number),
    },
    fire: () => {
      for (const [id, cb] of [...tasks]) {
        tasks.delete(id);
        cb();
      }
    },
  };
}

function setup(overrides: Partial<CanvasHostOptions> = {}, canvasHash = HASH) {
  const editorWindow = new FakeWindow(EDITOR);
  const canvasWindow = new FakeWindow(CANVAS);
  editorWindow.peer = canvasWindow;
  canvasWindow.peer = editorWindow;

  const store = createEditorStore({
    doc: fixture(),
    registry,
    generateId: createSeededIdGenerator(5),
    validationDelayMs: null,
  });
  const frames = manualFrames();
  const clock = manualTimers();
  const rejections: Rejection[] = [];
  let host: ReturnType<typeof createCanvasHost> | undefined;
  const transport = createParentTransport({
    iframe: { contentWindow: canvasWindow.handle },
    canvasOrigin: CANVAS,
    session: SESSION,
    host: editorWindow,
    onReject: (r) => {
      rejections.push(r);
      host?.handleReject(r);
    },
  });
  host = createCanvasHost({
    store,
    transport,
    manifestHash: HASH,
    locales,
    breakpoints: DEFAULT_BREAKPOINTS,
    frames: frames.frames,
    timers: clock.timers,
    ...overrides,
  });

  const received: EditorMessage[] = [];
  const connect = (hash = canvasHash) => {
    const child: Transport<CanvasMessage, EditorMessage> = createChildTransport({
      allowedOrigins: [EDITOR],
      session: SESSION,
      host: canvasWindow,
      parent: editorWindow.handle,
    });
    for (const type of [
      'editor:init',
      'doc:patch',
      'doc:set',
      'selection:set',
      'hover:set',
      'viewport:set',
      'locale:set',
      'mode:set',
      'view:set',
      'ping',
    ] as const) {
      child.on(type, (payload) => received.push({ type, payload } as unknown as EditorMessage));
    }
    child.send('canvas:hello', {
      protocol: PROTOCOL_VERSION,
      rendererVersion: '1.0.0',
      manifestHash: hash,
    });
    return child;
  };
  return { store, host, connect, frames, clock, received, rejections, editorWindow, canvasWindow };
}

const types = (received: EditorMessage[]) => received.map((m) => m.type);
const click = (id: string, extra: Partial<typeof mods> = {}) => ({
  id,
  modifiers: { ...mods, ...extra },
});

describe('the handshake', () => {
  it('answers a hello with the store as it is, and is ready when the canvas says so', () => {
    const { store, host, connect, received } = setup();
    store.select('textNodeA1');
    expect(host.state.getState().status).toBe('connecting');
    const child = connect();
    expect(host.state.getState().status).toBe('initializing');
    const [init] = received;
    expect(init?.type).toBe('editor:init');
    expect(init?.payload).toMatchObject({
      docVersion: 0,
      selection: ['textNodeA1'],
      viewport: { breakpoint: 'desktop', width: 1280 },
      locale: 'en',
      mode: 'edit',
    });
    child.send('canvas:ready', {});
    expect(host.state.getState().status).toBe('ready');
    host.destroy();
  });

  it('shows an error for a canvas of other components, and recovers with a right one', () => {
    const { host, connect } = setup({}, 'other-hash');
    const wrong = connect();
    expect(host.state.getState().status).toBe('error');
    expect(host.state.getState().error).toMatchObject({ kind: 'manifest' });
    wrong.close();
    connect(HASH);
    expect(host.state.getState().status).toBe('initializing');
    expect(host.state.getState().error).toBeUndefined();
    host.destroy();
  });

  it('starts the session over on a hello after init, and clears a lost connection', () => {
    const { store, host, connect, frames, clock, received } = setup();
    const child = connect();
    child.send('canvas:ready', {});
    clock.fire();
    host.state.setState({ connectionLost: true });
    store.dispatch({
      type: 'node.setProp',
      payload: { id: 'textNodeA1', prop: 'text', value: s('One') },
    });
    received.length = 0;
    child.send('canvas:hello', {
      protocol: PROTOCOL_VERSION,
      rendererVersion: '1.0.0',
      manifestHash: HASH,
    });
    expect(host.state.getState()).toMatchObject({ status: 'initializing', connectionLost: false });
    expect(host.state.getState().connections).toBe(2);
    expect(types(received)).toEqual(['editor:init', 'view:set']);
    frames.run();
    expect(types(received)).toEqual(['editor:init', 'view:set']);
    child.send('canvas:ready', {});
    expect(host.state.getState().status).toBe('ready');
    host.destroy();
  });

  it('shows a timeout when no canvas answers', () => {
    const { host, clock } = setup();
    clock.fire();
    expect(host.state.getState().error?.kind).toBe('timeout');
    host.destroy();
  });

  it('names a canvas of another protocol version', () => {
    const { host, editorWindow, canvasWindow } = setup();
    for (const listener of [...editorWindow.listeners]) {
      listener({
        origin: CANVAS,
        source: canvasWindow.handle,
        data: {
          source: 'buildr',
          protocol: PROTOCOL_VERSION + 1,
          session: SESSION,
          type: 'canvas:hello',
          payload: { protocol: PROTOCOL_VERSION + 1, rendererVersion: '1', manifestHash: HASH },
        },
      });
    }
    expect(host.state.getState().error).toMatchObject({
      kind: 'protocol',
      details: { editor: PROTOCOL_VERSION, canvas: PROTOCOL_VERSION + 1 },
    });
    host.destroy();
  });
});

describe('sending changes', () => {
  it('batches the patches of one frame into a single doc:patch', () => {
    const { store, host, connect, frames, received } = setup();
    connect().send('canvas:ready', {});
    received.length = 0;
    store.dispatch({
      type: 'node.setProp',
      payload: { id: 'textNodeA1', prop: 'text', value: s('One') },
    });
    store.dispatch({
      type: 'node.setProp',
      payload: { id: 'textNodeB1', prop: 'text', value: s('Two') },
    });
    expect(received).toHaveLength(0);
    expect(frames.pending()).toBe(1);
    frames.run();
    expect(types(received)).toEqual(['doc:patch']);
    expect(received[0]?.payload).toMatchObject({ from: 0, to: 2 });
    host.destroy();
  });

  it('sends the whole document after a replacement, and on a resync request', () => {
    const { store, host, connect, frames, received } = setup();
    const child = connect();
    child.send('canvas:ready', {});
    received.length = 0;
    store.dispatch({
      type: 'node.setProp',
      payload: { id: 'textNodeA1', prop: 'text', value: s('One') },
    });
    store.replaceDocument(fixture());
    frames.run();
    expect(types(received)).toEqual(['doc:set']);
    expect(received[0]?.payload).toMatchObject({ docVersion: 2 });

    received.length = 0;
    child.send('doc:resync-request', { have: 1 });
    expect(types(received)).toEqual(['doc:set']);
    host.destroy();
  });

  it('sends selection and hover at once, and only when they change', () => {
    const { store, host, connect, received } = setup();
    connect().send('canvas:ready', {});
    received.length = 0;
    store.select('textNodeA1');
    store.setHovered('textNodeB1');
    store.setHovered('textNodeB1');
    expect(received.map((m) => [m.type, m.payload])).toEqual([
      ['selection:set', { ids: ['textNodeA1'] }],
      ['hover:set', { id: 'textNodeB1' }],
    ]);
    host.destroy();
  });

  it('does not send anything to a canvas that is not there yet, and inits it with the latest', () => {
    const { store, host, connect, frames, received } = setup();
    store.dispatch({
      type: 'node.setProp',
      payload: { id: 'textNodeA1', prop: 'text', value: s('Early') },
    });
    frames.run();
    connect();
    expect(types(received)).toEqual(['editor:init', 'view:set']);
    expect(received[0]?.payload).toMatchObject({ docVersion: 1 });
    host.destroy();
  });

  it('a canvas that reloads is initialized again, with nothing lost', () => {
    const { store, host, connect, received } = setup();
    const first = connect();
    first.send('canvas:ready', {});
    store.select('textNodeB1');
    first.close();
    received.length = 0;
    connect();
    expect(received[0]?.type).toBe('editor:init');
    expect(received[0]?.payload).toMatchObject({ selection: ['textNodeB1'] });
    expect(host.state.getState().connections).toBe(2);
    host.destroy();
  });

  it('sends the viewport, locale, mode and context when they change', () => {
    const { host, connect, received } = setup();
    connect().send('canvas:ready', {});
    received.length = 0;
    host.setBreakpoint('mobile');
    host.setLocale('pl');
    host.setLocale('xx');
    host.setMode('interact');
    expect(received.map((m) => [m.type, m.payload])).toEqual([
      ['viewport:set', { breakpoint: 'mobile', width: 390 }],
      ['locale:set', { locale: 'pl' }],
      ['mode:set', { mode: 'interact' }],
    ]);
    host.destroy();
  });
});

describe('what the canvas reports', () => {
  it('a click selects, with Shift adding and Ctrl toggling', () => {
    const { store, host, connect } = setup();
    const child = connect();
    child.send('node:click', { ...click('textNodeA1'), instance: 'loop:1' });
    expect(store.getState().selectedIds).toEqual(['textNodeA1']);
    expect(store.getState().selectedInstance).toBe('loop:1');
    child.send('node:click', click('textNodeB1', { shift: true }));
    expect(store.getState().selectedIds).toEqual(['textNodeA1', 'textNodeB1']);
    child.send('node:click', click('textNodeA1', { ctrl: true }));
    expect(store.getState().selectedIds).toEqual(['textNodeB1']);
    child.send('node:hover', click('boxNode001'));
    expect(store.getState().hoveredId).toBe('boxNode001');
    host.destroy();
  });

  it('an inline edit becomes node.setProp, in the current locale', () => {
    const { store, host, connect } = setup();
    const child = connect();
    child.send('inline:commit', { id: 'textNodeA1', prop: 'text', value: 'Edited' });
    expect(JSON.stringify(store.getState().doc.nodes['textNodeA1']?.props?.['text'])).toContain(
      'Edited',
    );
    expect(store.getState().undoLabel).toBe('inline-edit');
    host.destroy();
  });

  it('does not move, remove or duplicate a block that is locked for structure, and says so', () => {
    const onLocked = vi.fn();
    const onAction = vi.fn();
    const { store, host, connect } = setup({ onLocked, onAction });
    const doc = fixture();
    store.replaceDocument({
      ...doc,
      nodes: {
        ...doc.nodes,
        textNodeB1: { ...node('textNodeB1', 'buildr/text'), lock: { structure: true } },
      },
    });
    const child = connect();
    const before = store.getState().doc;
    child.send('intent:move', {
      ids: ['textNodeB1'],
      target: { parentId: 'boxNode001', slot: 'default', index: 0 },
    });
    child.send('intent:action', { id: 'textNodeB1', action: 'remove' });
    child.send('intent:action', { id: 'textNodeB1', action: 'duplicate' });
    expect(store.getState().doc).toBe(before);
    expect(onLocked).toHaveBeenCalledTimes(3);
    expect(onAction).not.toHaveBeenCalled();
    host.destroy();
  });

  it('a move intent becomes node.move; a refused command is reported', () => {
    const onCommandError = vi.fn();
    const { store, host, connect } = setup({ onCommandError });
    const child = connect();
    child.send('intent:move', {
      ids: ['textNodeB1'],
      target: { parentId: 'boxNode001', slot: 'default', index: 0 },
    });
    expect(store.getState().doc.nodes['boxNode001']?.slots?.['default']).toEqual([
      'textNodeB1',
      'textNodeA1',
    ]);
    child.send('inline:commit', { id: 'ghostNode1', prop: 'text', value: 'x' });
    expect(onCommandError).toHaveBeenCalledTimes(1);
    host.destroy();
  });

  it('forwards keys, the context menu and drop targets, and keeps diagnostics', () => {
    const onKeyDown = vi.fn();
    const onContextMenu = vi.fn();
    const onDropTarget = vi.fn();
    const { host, connect } = setup({ onKeyDown, onContextMenu, onDropTarget });
    const child = connect();
    child.send('key:down', { key: 'z', code: 'KeyZ', mods: { ...mods, ctrl: true } });
    child.send('contextmenu', { id: 'textNodeA1', point: { x: 1, y: 2 } });
    child.send('dnd:target', { target: null });
    child.send('diagnostics', {
      items: [{ code: 'x', message: 'y', severity: 'warning' }],
    });
    expect(onKeyDown).toHaveBeenCalledOnce();
    expect(onContextMenu).toHaveBeenCalledOnce();
    expect(onDropTarget).toHaveBeenCalledWith({ target: null });
    expect(host.state.getState().diagnostics).toHaveLength(1);
    host.destroy();
  });

  it('a fatal canvas error shows the error screen; a non-fatal one does not', () => {
    const { host, connect } = setup();
    const child = connect();
    child.send('canvas:ready', {});
    child.send('canvas:error', { message: 'a node broke', fatal: false });
    expect(host.state.getState().status).toBe('ready');
    child.send('canvas:error', { message: 'boom', fatal: true });
    expect(host.state.getState()).toMatchObject({
      status: 'error',
      error: { kind: 'canvas', message: 'boom' },
    });
    host.destroy();
  });
});

describe('protocol v2 view and intents', () => {
  it('sends cached view on connect and reload, and changes immediately', () => {
    const { host, connect, received } = setup();
    host.setView({
      outlines: true,
      hidden: ['textNodeA1'],
      theme: 'dark',
      labels: { toolbar: 'Tools' },
    });
    const child = connect();
    expect(received.at(-1)).toMatchObject({
      type: 'view:set',
      payload: { outlines: true, hidden: ['textNodeA1'], theme: 'dark' },
    });
    host.setView({ outlines: false });
    expect(received.at(-1)).toMatchObject({
      type: 'view:set',
      payload: { outlines: false, labels: { toolbar: 'Tools' } },
    });
    child.close();
    received.length = 0;
    connect();
    expect(received.at(-1)).toMatchObject({
      type: 'view:set',
      payload: { outlines: false, hidden: ['textNodeA1'] },
    });
    host.destroy();
  });

  it('forwards only existing, editable action and insertion targets', () => {
    const onAction = vi.fn();
    const onInsert = vi.fn();
    const { host, connect, store } = setup({ onAction, onInsert });
    const child = connect();
    child.send('intent:action', { id: 'textNodeA1', action: 'duplicate' });
    expect(onAction).toHaveBeenCalledOnce();
    child.send('intent:action', { id: 'ghostNode1', action: 'duplicate' });
    child.send('intent:action', { id: 'root', action: 'remove' });
    const target = { parentId: 'boxNode001', slot: 'default', index: 1 };
    child.send('intent:insert', { target });
    expect(onInsert).toHaveBeenCalledWith({ target });
    child.send('intent:insert', { target: { ...target, index: 3 } });
    child.send('intent:insert', { target: { ...target, slot: 'missing' } });
    store.setReadOnly(true);
    child.send('intent:action', { id: 'textNodeA1', action: 'remove' });
    child.send('intent:insert', { target });
    expect(onAction).toHaveBeenCalledOnce();
    expect(onInsert).toHaveBeenCalledOnce();
    store.setReadOnly(false);
    const doc = fixture();
    store.replaceDocument({
      ...doc,
      nodes: {
        ...doc.nodes,
        boxNode001: {
          ...node('boxNode001', 'buildr/box', { slots: { default: ['textNodeA1', 'textNodeB1'] } }),
          lock: { structure: true, style: true },
        },
      },
    });
    child.send('intent:action', { id: 'textNodeA1', action: 'duplicate' });
    child.send('intent:action', { id: 'textNodeA1', action: 'align', value: 'center' });
    child.send('intent:insert', { target });
    expect(onAction).toHaveBeenCalledOnce();
    expect(onInsert).toHaveBeenCalledOnce();
    host.destroy();
  });

  const realTimers = {
    setTimeout: (cb: () => void, ms: number) => setTimeout(cb, ms),
    clearTimeout: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  };

  it('detects missing pong, recovers, and clears heartbeat timers on destroy', async () => {
    vi.useFakeTimers();
    try {
      const { host, connect, received } = setup({ timers: realTimers });
      const child = connect();
      child.send('canvas:ready', {});
      expect(types(received)).toContain('ping');
      await vi.advanceTimersByTimeAsync(15_000);
      expect(host.state.getState().connectionLost).toBe(true);
      // From now on the canvas answers, as the runtime does: with `reply`, which names the ping's id.
      child.on('ping', (_payload, message) => child.reply(message, 'pong', {}));
      await vi.advanceTimersByTimeAsync(20_000);
      expect(host.state.getState().connectionLost).toBe(false);
      host.destroy();
      await vi.advanceTimersByTimeAsync(0);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stays connected while the canvas answers every ping, through a second hello', async () => {
    vi.useFakeTimers();
    try {
      const { host, connect } = setup({ timers: realTimers });
      const child = connect();
      child.on('ping', (_payload, message) => child.reply(message, 'pong', {}));
      child.send('canvas:ready', {});
      await vi.advanceTimersByTimeAsync(40_000);
      expect(host.state.getState().connectionLost).toBe(false);
      // The canvas says hello again (its silence watchdog, a second mount): the session starts over.
      child.send('canvas:hello', {
        protocol: PROTOCOL_VERSION,
        rendererVersion: '1.0.0',
        manifestHash: HASH,
      });
      child.send('canvas:ready', {});
      await vi.advanceTimersByTimeAsync(40_000);
      expect(host.state.getState().connections).toBe(2);
      expect(host.state.getState().connectionLost).toBe(false);
      expect(host.state.getState().status).toBe('ready');
      host.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not take a pong that answers nothing for a sign of life', async () => {
    vi.useFakeTimers();
    try {
      const { host, connect } = setup({ timers: realTimers });
      const child = connect();
      child.on('ping', () => child.send('pong', {}));
      child.send('canvas:ready', {});
      await vi.advanceTimersByTimeAsync(15_000);
      expect(host.state.getState().connectionLost).toBe(true);
      host.destroy();
    } finally {
      vi.useRealTimers();
    }
  });
});
