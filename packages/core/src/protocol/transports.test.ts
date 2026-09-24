import { describe, expect, it, vi } from 'vitest';
import { createEmptyDocument } from '../document/create.ts';
import {
  type CanvasMessage,
  createChildTransport,
  createMessage,
  createParentTransport,
  createTransport,
  type EditorMessage,
  type MessageEventLike,
  type MessageType,
  type PayloadOf,
  type PostTarget,
  parseCanvasMessage,
  type Rejection,
  type Timers,
  type WindowLike,
} from './index.ts';

const SESSION = 'abcDEF0123456789_-xyz';
const EDITOR = 'https://editor.example.com';
const CANVAS = 'https://canvas.example.com';
const ID = 'AbCdEfGhIj';
const mods = { shift: false, alt: false, ctrl: false, meta: false };
const target = { parentId: 'root', slot: 'default', index: 0 };

// --- Doubles -----------------------------------------------------------------------------------

type Listener = (event: MessageEventLike) => void;

/**
 * A window with an origin. Posting to it delivers to its own listeners, as a browser does, but
 * only if the target origin is its origin, with the peer window as `source` and its origin as `origin`.
 */
class FakeWindow implements WindowLike {
  readonly listeners = new Set<Listener>();
  readonly posted: { message: unknown; targetOrigin: string }[] = [];
  peer: FakeWindow | undefined;
  readonly handle: PostTarget = {
    postMessage: (message, targetOrigin) => {
      this.posted.push({ message, targetOrigin });
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

  addEventListener(_type: 'message', listener: Listener): void {
    this.listeners.add(listener);
  }
  removeEventListener(_type: 'message', listener: Listener): void {
    this.listeners.delete(listener);
  }
  /** Delivers an event as if it had arrived, whatever its origin and source. */
  dispatch(event: MessageEventLike): void {
    for (const listener of [...this.listeners]) listener(event);
  }
}

/** What a window was sent, at position `index`. */
function sentOf(win: FakeWindow, index = 0): { id: string; replyTo?: string } {
  const posted = win.posted[index];
  if (posted === undefined) throw new Error('nothing was sent');
  return posted.message as { id: string; replyTo?: string };
}

function pair() {
  const editor = new FakeWindow(EDITOR);
  const canvas = new FakeWindow(CANVAS);
  editor.peer = canvas;
  canvas.peer = editor;
  return { editor, canvas };
}

function fakeTimers() {
  let now = 0;
  let next = 1;
  const tasks = new Map<number, { at: number; callback: () => void }>();
  const timers: Timers = {
    setTimeout: (callback, ms) => {
      const id = next++;
      tasks.set(id, { at: now + ms, callback });
      return id;
    },
    clearTimeout: (handle) => {
      tasks.delete(handle as number);
    },
  };
  return {
    timers,
    pending: () => tasks.size,
    advance(ms: number) {
      now += ms;
      for (const [id, task] of [...tasks]) {
        if (task.at <= now) {
          tasks.delete(id);
          task.callback();
        }
      }
    },
  };
}

function setup(options: { canvasOrigins?: string[]; onReject?: (r: Rejection) => void } = {}) {
  const { editor, canvas } = pair();
  const rejected: Rejection[] = [];
  const clock = fakeTimers();
  const parent = createParentTransport({
    iframe: { contentWindow: canvas.handle },
    canvasOrigin: CANVAS,
    session: SESSION,
    host: editor,
    timers: clock.timers,
    onReject: (r) => rejected.push(r),
    onError: (e) => {
      throw e;
    },
  });
  const childRejected: Rejection[] = [];
  const child = createChildTransport({
    allowedOrigins: options.canvasOrigins ?? [EDITOR],
    session: SESSION,
    host: canvas,
    parent: editor.handle,
    timers: clock.timers,
    onReject: (r) => childRejected.push(r),
    onError: (e) => {
      throw e;
    },
  });
  return { editor, canvas, parent, child, rejected, childRejected, clock };
}

const fromCanvas = <T extends MessageType>(type: T, payload: PayloadOf<T>, extra: object = {}) => ({
  ...createMessage(type, payload, { session: SESSION }),
  ...extra,
});

const hello = { protocol: 1, rendererVersion: '0.1.0', manifestHash: 'abc' };
const click = { id: ID, modifiers: mods };

/** An event as the editor's window would receive it from the canvas. */
const eventFrom = (
  canvas: FakeWindow,
  data: unknown,
  extra: Partial<MessageEventLike> = {},
): MessageEventLike => ({
  data,
  origin: CANVAS,
  source: canvas.handle,
  ...extra,
});

// --- Configuration -----------------------------------------------------------------------------

describe('configuration', () => {
  const base = {
    iframe: { contentWindow: null },
    canvasOrigin: CANVAS,
    session: SESSION,
    host: new FakeWindow(EDITOR),
  };

  it('accepts only a concrete origin for the canvas', () => {
    expect(() => createParentTransport(base)).not.toThrow();
    expect(() =>
      createParentTransport({ ...base, canvasOrigin: 'http://localhost:3000' }),
    ).not.toThrow();
    expect(() =>
      createParentTransport({ ...base, canvasOrigin: 'http://[::1]:3000' }),
    ).not.toThrow();
    for (const origin of [
      '*',
      'null',
      '',
      'canvas.example.com',
      'https://canvas.example.com/',
      'https://canvas.example.com/path',
      'https://*.example.com',
      'ftp://example.com',
      'https://user@example.com',
      'https://a b.com',
      'javascript:alert(1)',
      'https://example.com:99999999',
    ]) {
      expect(() => createParentTransport({ ...base, canvasOrigin: origin }), origin).toThrow(
        /origin/,
      );
    }
  });

  it('accepts only a real session', () => {
    for (const session of ['', 'short', 'has space in it 12345678', 'a'.repeat(129)]) {
      expect(() => createParentTransport({ ...base, session }), session).toThrow(/session/);
    }
  });

  it('needs a window to listen on', () => {
    const { host: _host, ...withoutHost } = base;
    expect(() => createParentTransport(withoutHost)).toThrow(/window/);
  });

  it('gives the canvas at least one allowed origin, all concrete', () => {
    const { canvas, editor } = pair();
    const opts = {
      allowedOrigins: [EDITOR],
      session: SESSION,
      host: canvas,
      parent: editor.handle,
    };
    expect(() => createChildTransport(opts)).not.toThrow();
    expect(() => createChildTransport({ ...opts, allowedOrigins: [] })).toThrow(/at least one/);
    for (const origin of ['*', 'null', 'https://editor.example.com/x']) {
      expect(
        () => createChildTransport({ ...opts, allowedOrigins: [EDITOR, origin] }),
        origin,
      ).toThrow(/origin/);
    }
    expect(() => createChildTransport({ ...opts, session: 'no' })).toThrow(/session/);
  });

  it('refuses to run in a canvas that is not inside a frame', () => {
    const { canvas } = pair();
    expect(() =>
      createChildTransport({
        allowedOrigins: [EDITOR],
        session: SESSION,
        host: canvas,
        parent: canvas,
      }),
    ).toThrow(/not inside a frame/);
  });
});

// --- What the editor accepts ------------------------------------------------------------------

describe('the editor end: what it lets through', () => {
  it('delivers a valid message from the canvas, with its payload and the whole message', () => {
    const { editor, canvas, parent } = setup();
    const handler = vi.fn();
    parent.on('node:click', handler);
    editor.dispatch(eventFrom(canvas, fromCanvas('node:click', click)));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]).toEqual(click);
    expect(handler.mock.calls[0]?.[1]).toMatchObject({ type: 'node:click', session: SESSION });
  });

  it('delivers to every handler of the type, and not to the handlers of another', () => {
    const { editor, canvas, parent } = setup();
    const a = vi.fn();
    const b = vi.fn();
    const other = vi.fn();
    parent.on('node:click', a);
    parent.on('node:click', b);
    parent.on('canvas:ready', other);
    editor.dispatch(eventFrom(canvas, fromCanvas('node:click', click)));
    expect([a, b, other].map((f) => f.mock.calls.length)).toEqual([1, 1, 0]);
  });

  it('stops delivering to a handler that unsubscribed', () => {
    const { editor, canvas, parent } = setup();
    const handler = vi.fn();
    const off = parent.on('node:click', handler);
    off();
    editor.dispatch(eventFrom(canvas, fromCanvas('node:click', click)));
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('the editor end: what it drops', () => {
  function expectDropped(event: (canvas: FakeWindow) => MessageEventLike, reason: string) {
    const { editor, canvas, parent, rejected } = setup();
    const handler = vi.fn();
    parent.on('node:click', handler);
    parent.on('canvas:hello', handler);
    editor.dispatch(event(canvas));
    expect(handler).not.toHaveBeenCalled();
    expect(rejected.map((r) => r.reason)).toEqual([reason]);
    return rejected[0] as Rejection;
  }
  const valid = () => fromCanvas('node:click', click);

  it('a message from another origin', () => {
    for (const origin of [
      'https://evil.example.com',
      'http://canvas.example.com',
      'https://canvas.example.com:8443',
      'null',
      '',
      'https://canvas.example.com.evil.com',
    ]) {
      const r = expectDropped((c) => eventFrom(c, valid(), { origin }), 'origin');
      expect(r.origin).toBe(origin);
    }
  });

  it('a message from another window, even one of the right origin', () => {
    expectDropped(
      () => ({ data: valid(), origin: CANVAS, source: new FakeWindow(CANVAS).handle }),
      'source',
    );
    expectDropped(() => ({ data: valid(), origin: CANVAS, source: null }), 'source');
    expectDropped(() => ({ data: valid(), origin: CANVAS, source: undefined }), 'source');
    expectDropped(() => ({ data: valid(), origin: CANVAS, source: {} }), 'source');
  });

  it('every message when the frame has no window yet', () => {
    const { editor, canvas } = pair();
    const rejected: Rejection[] = [];
    createParentTransport({
      iframe: { contentWindow: null },
      canvasOrigin: CANVAS,
      session: SESSION,
      host: editor,
      onReject: (r) => rejected.push(r),
    });
    editor.dispatch(eventFrom(canvas, valid()));
    expect(rejected.map((r) => r.reason)).toEqual(['source']);
  });

  it('follows the frame when it gets a new window (a reload)', () => {
    const { editor, canvas } = pair();
    const frame: { contentWindow: PostTarget | null } = { contentWindow: canvas.handle };
    const rejected: Rejection[] = [];
    const handler = vi.fn();
    const parent = createParentTransport({
      iframe: frame,
      canvasOrigin: CANVAS,
      session: SESSION,
      host: editor,
      onReject: (r) => rejected.push(r),
    });
    parent.on('node:click', handler);
    const reloaded = new FakeWindow(CANVAS);
    frame.contentWindow = reloaded.handle;
    editor.dispatch(eventFrom(canvas, valid()));
    editor.dispatch(eventFrom(reloaded, valid()));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(rejected.map((r) => r.reason)).toEqual(['source']);
  });

  it('what is not an envelope of ours', () => {
    for (const data of [
      undefined,
      null,
      'buildr',
      5,
      [],
      {},
      { ...valid(), source: 'other' },
      { ...valid(), extra: 1 },
      { ...valid(), session: 'no' },
    ]) {
      const { editor, canvas, rejected } = setup();
      editor.dispatch(eventFrom(canvas, data));
      expect(rejected.length, String(JSON.stringify(data))).toBe(1);
      expect(['envelope']).toContain(rejected[0]?.reason);
    }
  });

  it('a message of another session, even a perfect one', () => {
    const r = expectDropped(
      (c) => eventFrom(c, { ...valid(), session: 'zzzzzzzzzzzzzzzzzzzz' }),
      'session',
    );
    expect(r.diagnostic).toBeUndefined();
  });

  it('a message of another protocol version, and says which', () => {
    const r = expectDropped(
      (c) =>
        eventFrom(c, { ...fromCanvas('canvas:hello', { ...hello, protocol: 2 }), protocol: 2 }),
      'version',
    );
    expect(r.protocol).toBe(2);
  });

  it('a message of a type the protocol does not know, or with a malformed payload', () => {
    expectDropped((c) => eventFrom(c, { ...valid(), type: 'node:explode' }), 'schema');
    expectDropped(
      (c) => eventFrom(c, { ...valid(), payload: { id: 'nope', modifiers: mods } }),
      'schema',
    );
    expectDropped((c) => eventFrom(c, { ...valid(), payload: { ...click, extra: 1 } }), 'schema');
    const r = expectDropped((c) => eventFrom(c, { ...valid(), payload: null }), 'schema');
    expect(r.diagnostic?.code).toBe('protocol.invalid-message');
  });

  it('a message the canvas may not send: an editor message', () => {
    const r = expectDropped(
      (c) => eventFrom(c, createMessage('selection:set', { ids: [] }, { session: SESSION })),
      'direction',
    );
    expect(r.diagnostic?.code).toBe('protocol.invalid-message');
  });

  it('checks the origin before anything else, and the source before the envelope', () => {
    const { editor, canvas, rejected } = setup();
    editor.dispatch({ data: 'garbage', origin: 'https://evil.example.com', source: null });
    editor.dispatch({ data: 'garbage', origin: CANVAS, source: null });
    editor.dispatch(eventFrom(canvas, 'garbage'));
    expect(rejected.map((r) => r.reason)).toEqual(['origin', 'source', 'envelope']);
  });

  it('survives an event with no usable origin', () => {
    const { editor, canvas, rejected } = setup();
    editor.dispatch({
      data: valid(),
      origin: undefined as unknown as string,
      source: canvas.handle,
    });
    expect(rejected.map((r) => r.reason)).toEqual(['origin']);
  });

  it('nothing at all when nobody asked for a report', () => {
    const { editor, canvas } = pair();
    createParentTransport({
      iframe: { contentWindow: canvas.handle },
      canvasOrigin: CANVAS,
      session: SESSION,
      host: editor,
    });
    expect(() =>
      editor.dispatch(eventFrom(canvas, 'garbage', { origin: 'https://evil.example.com' })),
    ).not.toThrow();
  });
});

// --- What the editor sends --------------------------------------------------------------------

describe('the editor end: what it sends', () => {
  it('posts to the canvas window, addressed to the canvas origin alone', () => {
    const { parent, canvas } = setup();
    expect(parent.send('selection:set', { ids: [ID] })).toBe(true);
    expect(canvas.posted).toHaveLength(1);
    expect(canvas.posted[0]?.targetOrigin).toBe(CANVAS);
    expect(canvas.posted[0]?.message).toMatchObject({
      source: 'buildr',
      protocol: 1,
      session: SESSION,
      type: 'selection:set',
      payload: { ids: [ID] },
    });
  });

  it('never posts to the wildcard origin, and refuses if it ever came to that', () => {
    const { parent, canvas } = setup();
    parent.send('hover:set', { id: null });
    parent.send('dnd:leave', {});
    expect(canvas.posted.every((p) => p.targetOrigin !== '*')).toBe(true);
  });

  it('says so when there is no window to send to', () => {
    const { editor } = pair();
    const parent = createParentTransport({
      iframe: { contentWindow: null },
      canvasOrigin: CANVAS,
      session: SESSION,
      host: editor,
    });
    expect(parent.send('dnd:leave', {})).toBe(false);
    return expect(parent.request('dnd:leave', {})).rejects.toMatchObject({ code: 'closed' });
  });

  it('marks an answer with the id of the request', () => {
    const { parent, canvas } = setup();
    expect(
      parent.reply({ id: 'r9' }, 'doc:set', {
        doc: createEmptyDocument(),
        docVersion: 1,
      }),
    ).toBe(true);
    expect(sentOf(canvas, 0).replyTo).toBe('r9');
    expect(parent.reply({}, 'dnd:leave', {})).toBe(false);
    expect(parent.send('dnd:leave', {}, { replyTo: 'r3' })).toBe(true);
    expect(sentOf(canvas, 1).replyTo).toBe('r3');
  });
});

// --- Requests ---------------------------------------------------------------------------------

describe('requests', () => {
  it('resolve with the answer, matched by id, and are not also given to the handlers', async () => {
    const { editor, canvas, parent } = setup();
    const handler = vi.fn();
    parent.on('dnd:target', handler);
    const answer = parent.request('dnd:over', {
      point: { x: 1, y: 2 },
      item: { kind: 'nodes', ids: [ID] },
    });
    const sent = canvas.posted[0]?.message as { id: string };
    expect(sent.id).toMatch(/^r\d+$/);
    editor.dispatch(eventFrom(canvas, fromCanvas('dnd:target', { target }, { replyTo: sent.id })));
    await expect(answer).resolves.toMatchObject({
      type: 'dnd:target',
      payload: { target },
      replyTo: sent.id,
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('give each request its own id, and match each answer to its own', async () => {
    const { editor, canvas, parent } = setup();
    const first = parent.request('dnd:over', {
      point: { x: 1, y: 1 },
      item: { kind: 'nodes', ids: [ID] },
    });
    const second = parent.request('dnd:over', {
      point: { x: 2, y: 2 },
      item: { kind: 'nodes', ids: [ID] },
    });
    const ids = canvas.posted.map((p) => (p.message as { id: string }).id);
    expect(new Set(ids).size).toBe(2);
    editor.dispatch(
      eventFrom(canvas, fromCanvas('dnd:target', { target: null }, { replyTo: ids[1] })),
    );
    editor.dispatch(eventFrom(canvas, fromCanvas('dnd:target', { target }, { replyTo: ids[0] })));
    expect((await first).payload).toEqual({ target });
    expect((await second).payload).toEqual({ target: null });
  });

  it('fail with a timeout when no answer comes, and forget the request', async () => {
    const { parent, clock } = setup();
    const answer = parent.request('dnd:leave', {}, { timeoutMs: 100 });
    const caught = answer.catch((e) => e);
    clock.advance(99);
    expect(clock.pending()).toBe(1);
    clock.advance(1);
    const error = await caught;
    expect(error).toMatchObject({ name: 'TransportError', code: 'timeout' });
    expect(error.message).toContain('dnd:leave');
    expect(clock.pending()).toBe(0);
  });

  it('wait five seconds by default, or as long as the transport was told', async () => {
    const { parent, clock } = setup();
    const caught = parent.request('dnd:leave', {}).catch((e) => e);
    clock.advance(4999);
    expect(clock.pending()).toBe(1);
    clock.advance(1);
    expect((await caught).code).toBe('timeout');

    const { editor, canvas } = pair();
    const timed = fakeTimers();
    const slow = createParentTransport({
      iframe: { contentWindow: canvas.handle },
      canvasOrigin: CANVAS,
      session: SESSION,
      host: editor,
      timers: timed.timers,
      requestTimeoutMs: 20,
    });
    const slowCaught = slow.request('dnd:leave', {}).catch((e) => e);
    timed.advance(20);
    expect((await slowCaught).code).toBe('timeout');
  });

  it('drop an answer that comes after the timeout, and one nobody asked for', async () => {
    const { editor, canvas, parent, clock, rejected } = setup();
    const answer = parent.request('dnd:leave', {}, { timeoutMs: 10 }).catch((e) => e);
    const id = sentOf(canvas, 0).id;
    clock.advance(10);
    await answer;
    editor.dispatch(eventFrom(canvas, fromCanvas('canvas:ready', {}, { replyTo: id })));
    editor.dispatch(eventFrom(canvas, fromCanvas('canvas:ready', {}, { replyTo: 'r999' })));
    expect(rejected.map((r) => r.reason)).toEqual(['stale-reply', 'stale-reply']);
  });

  it('take no answer from the wrong place: a forged reply is dropped and the request goes on waiting', async () => {
    const { editor, canvas, parent, rejected } = setup();
    const answer = parent.request(
      'dnd:over',
      { point: { x: 1, y: 1 }, item: { kind: 'nodes', ids: [ID] } },
      { timeoutMs: 1000 },
    );
    const id = sentOf(canvas, 0).id;
    editor.dispatch(
      eventFrom(canvas, fromCanvas('dnd:target', { target: null }, { replyTo: id }), {
        origin: 'https://evil.example.com',
      }),
    );
    editor.dispatch(
      eventFrom(canvas, fromCanvas('dnd:target', { target: null }, { replyTo: id }), {
        source: new FakeWindow(CANVAS).handle,
      }),
    );
    editor.dispatch(
      eventFrom(canvas, {
        ...fromCanvas('dnd:target', { target: null }, { replyTo: id }),
        session: 'zzzzzzzzzzzzzzzzzzzz',
      }),
    );
    expect(rejected.map((r) => r.reason)).toEqual(['origin', 'source', 'session']);
    editor.dispatch(eventFrom(canvas, fromCanvas('dnd:target', { target }, { replyTo: id })));
    await expect(answer).resolves.toMatchObject({ payload: { target } });
  });

  it('fail when the transport is closed, and cannot be made on a closed one', async () => {
    const { parent, clock } = setup();
    const answer = parent.request('dnd:leave', {}).catch((e) => e);
    parent.close();
    expect(await answer).toMatchObject({ code: 'closed' });
    expect(clock.pending()).toBe(0);
    await expect(parent.request('dnd:leave', {})).rejects.toMatchObject({ code: 'closed' });
  });
});

// --- Handlers and closing ---------------------------------------------------------------------

describe('handlers and closing', () => {
  it('report a handler that throws, and still run the others', () => {
    const { editor, canvas, canvas: c } = pair();
    const errors: unknown[] = [];
    const parent = createParentTransport({
      iframe: { contentWindow: canvas.handle },
      canvasOrigin: CANVAS,
      session: SESSION,
      host: editor,
      onError: (e) => errors.push(e),
    });
    const after = vi.fn();
    parent.on('canvas:ready', () => {
      throw new Error('handler failed');
    });
    parent.on('canvas:ready', after);
    editor.dispatch(eventFrom(c, fromCanvas('canvas:ready', {})));
    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toBe('handler failed');
    expect(after).toHaveBeenCalledTimes(1);
  });

  it('rethrow it from a timer when nobody is listening for errors, so it is not lost', () => {
    const { editor, canvas } = pair();
    const clock = fakeTimers();
    const thrown: unknown[] = [];
    const timers: Timers = {
      setTimeout: (cb, ms) =>
        clock.timers.setTimeout(() => {
          try {
            cb();
          } catch (e) {
            thrown.push(e);
          }
        }, ms),
      clearTimeout: clock.timers.clearTimeout,
    };
    const parent = createParentTransport({
      iframe: { contentWindow: canvas.handle },
      canvasOrigin: CANVAS,
      session: SESSION,
      host: editor,
      timers,
    });
    parent.on('canvas:ready', () => {
      throw new Error('lost?');
    });
    editor.dispatch(eventFrom(canvas, fromCanvas('canvas:ready', {})));
    expect(thrown).toHaveLength(0);
    clock.advance(0);
    expect((thrown[0] as Error).message).toBe('lost?');
  });

  it('stop listening when closed, and then neither deliver nor send', () => {
    const { editor, canvas, parent } = setup();
    const handler = vi.fn();
    parent.on('canvas:ready', handler);
    expect(editor.listeners.size).toBe(1);
    parent.close();
    parent.close();
    expect(editor.listeners.size).toBe(0);
    editor.dispatch(eventFrom(canvas, fromCanvas('canvas:ready', {})));
    expect(handler).not.toHaveBeenCalled();
    expect(parent.send('dnd:leave', {})).toBe(false);
    expect(canvas.posted).toHaveLength(0);
  });

  it('use the environment’s timers unless given others', async () => {
    vi.useFakeTimers();
    try {
      const { editor, canvas } = pair();
      const parent = createParentTransport({
        iframe: { contentWindow: canvas.handle },
        canvasOrigin: CANVAS,
        session: SESSION,
        host: editor,
      });
      const caught = parent.request('dnd:leave', {}, { timeoutMs: 50 }).catch((e) => e);
      await vi.advanceTimersByTimeAsync(50);
      expect((await caught).code).toBe('timeout');
    } finally {
      vi.useRealTimers();
    }
  });
});

// --- The canvas end ---------------------------------------------------------------------------

describe('the canvas end', () => {
  const editorMessage = (type: 'selection:set' | 'dnd:leave' = 'selection:set') =>
    type === 'selection:set'
      ? createMessage('selection:set', { ids: [ID] }, { session: SESSION })
      : createMessage('dnd:leave', {}, { session: SESSION });

  it('delivers a valid message from the editor, and nothing that fails a check', () => {
    const { canvas, editor, child, childRejected } = setup();
    const handler = vi.fn();
    child.on('selection:set', handler);
    const good = { data: editorMessage(), origin: EDITOR, source: editor.handle };
    canvas.dispatch(good);
    expect(handler).toHaveBeenCalledTimes(1);

    canvas.dispatch({ ...good, origin: 'https://evil.example.com' });
    canvas.dispatch({ ...good, source: new FakeWindow(EDITOR).handle });
    canvas.dispatch({ ...good, data: 'nope' });
    canvas.dispatch({ ...good, data: { ...editorMessage(), session: 'zzzzzzzzzzzzzzzzzzzz' } });
    canvas.dispatch({ ...good, data: { ...editorMessage(), protocol: 3 } });
    canvas.dispatch({ ...good, data: { ...editorMessage(), payload: { ids: 'x' } } });
    canvas.dispatch({ ...good, data: createMessage('canvas:ready', {}, { session: SESSION }) });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(childRejected.map((r) => r.reason)).toEqual([
      'origin',
      'source',
      'envelope',
      'session',
      'version',
      'schema',
      'direction',
    ]);
  });

  it('starts by addressing every allowed origin, since it cannot yet know which is the editor', () => {
    const { editor, canvas } = pair();
    const child = createChildTransport({
      allowedOrigins: [EDITOR, 'https://other.example.com', EDITOR],
      session: SESSION,
      host: canvas,
      parent: editor.handle,
    });
    expect(child.send('canvas:hello', hello)).toBe(true);
    expect(editor.posted.map((p) => p.targetOrigin)).toEqual([EDITOR, 'https://other.example.com']);
    expect(editor.posted.every((p) => p.targetOrigin !== '*')).toBe(true);
  });

  it('then addresses only the origin the editor spoke from, and refuses the other allowed ones', () => {
    const { editor, canvas } = pair();
    const rejected: Rejection[] = [];
    const child = createChildTransport({
      allowedOrigins: [EDITOR, 'https://other.example.com'],
      session: SESSION,
      host: canvas,
      parent: editor.handle,
      onReject: (r) => rejected.push(r),
    });
    const handler = vi.fn();
    child.on('selection:set', handler);
    canvas.dispatch({
      data: editorMessage(),
      origin: 'https://other.example.com',
      source: editor.handle,
    });
    expect(handler).toHaveBeenCalledTimes(1);
    child.send('canvas:ready', {});
    expect(editor.posted.at(-1)?.targetOrigin).toBe('https://other.example.com');
    canvas.dispatch({ data: editorMessage(), origin: EDITOR, source: editor.handle });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(rejected.map((r) => r.reason)).toEqual(['origin']);
  });

  it('is not locked by a message that failed a check', () => {
    const { editor, canvas } = pair();
    const child = createChildTransport({
      allowedOrigins: [EDITOR, 'https://other.example.com'],
      session: SESSION,
      host: canvas,
      parent: editor.handle,
    });
    canvas.dispatch({
      data: { ...editorMessage(), session: 'zzzzzzzzzzzzzzzzzzzz' },
      origin: 'https://other.example.com',
      source: editor.handle,
    });
    child.send('canvas:ready', {});
    expect(editor.posted.map((p) => p.targetOrigin)).toEqual([EDITOR, 'https://other.example.com']);
  });

  it('answers a request of the editor', async () => {
    const { parent, child } = setup();
    child.on('dnd:over', (_payload, message) => {
      child.reply(message, 'dnd:target', { target });
    });
    const answer = await parent.request('dnd:over', {
      point: { x: 1, y: 2 },
      item: { kind: 'nodes', ids: [ID] },
    });
    expect(answer).toMatchObject({ type: 'dnd:target', payload: { target } });
  });

  it('can ask the editor, and be answered', async () => {
    const { parent, child } = setup();
    parent.on('doc:resync-request', (_payload, message) => {
      parent.reply(message, 'doc:set', {
        doc: createEmptyDocument(),
        docVersion: 4,
      });
    });
    const answer = await child.request('doc:resync-request', { have: 2 });
    expect(answer).toMatchObject({ type: 'doc:set', payload: { docVersion: 4 } });
  });
});

// --- Both ends together -----------------------------------------------------------------------

describe('a handshake, end to end', () => {
  it('goes hello, init, ready, and then edits flow', () => {
    const { editor, canvas } = pair();
    const clock = fakeTimers();
    const parent = createParentTransport({
      iframe: { contentWindow: canvas.handle },
      canvasOrigin: CANVAS,
      session: SESSION,
      host: editor,
      timers: clock.timers,
    });
    const child = createChildTransport({
      allowedOrigins: [EDITOR],
      session: SESSION,
      host: canvas,
      parent: editor.handle,
      timers: clock.timers,
    });
    const log: string[] = [];

    parent.on('canvas:hello', (payload) => {
      log.push(`hello ${payload.protocol}`);
      parent.send('editor:init', {
        doc: {
          schemaVersion: 1,
          root: 'root',
          nodes: { root: { id: 'root', type: 'buildr/page' } },
          components: { 'buildr/page': 1 },
        } as never,
        docVersion: 0,
        selection: [],
        viewport: { breakpoint: 'desktop', width: 1280 },
        contextRef: null,
        locale: 'en',
        locales: { locales: ['en'], default: 'en', fallback: true, intl: { en: 'English' } },
        mode: 'edit',
      });
    });
    child.on('editor:init', (payload) => {
      log.push(`init v${payload.docVersion}`);
      child.send('canvas:ready', {});
    });
    parent.on('canvas:ready', () => {
      log.push('ready');
      parent.send('doc:patch', {
        from: 0,
        to: 1,
        patches: [{ op: 'replace', path: ['nodes', 'root', 'name'], value: 'Home' }],
      });
    });
    child.on('doc:patch', (payload) => log.push(`patch ${payload.from}->${payload.to}`));

    child.send('canvas:hello', hello);
    expect(log).toEqual(['hello 1', 'init v0', 'ready', 'patch 0->1']);
  });

  it('is deaf to a second editor on another origin once it has found the first', () => {
    const { editor, canvas } = pair();
    const child = createChildTransport({
      allowedOrigins: [EDITOR, 'https://second.example.com'],
      session: SESSION,
      host: canvas,
      parent: editor.handle,
    });
    const handler = vi.fn();
    child.on('selection:set', handler);
    canvas.dispatch({
      data: createMessage('selection:set', { ids: [] }, { session: SESSION }),
      origin: EDITOR,
      source: editor.handle,
    });
    canvas.dispatch({
      data: createMessage('selection:set', { ids: [] }, { session: SESSION }),
      origin: 'https://second.example.com',
      source: editor.handle,
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

// Type-level: a side cannot send what only its peer may send.
describe('types', () => {
  it('keep each side to its own messages', () => {
    const { parent, child } = setup();
    // @ts-expect-error the editor cannot send a canvas message
    parent.send('canvas:ready', {});
    // @ts-expect-error the canvas cannot send an editor message
    child.send('selection:set', { ids: [] });
    // @ts-expect-error a handler is for a message this side receives
    parent.on('selection:set', () => {});
    const _editorOnly: EditorMessage['type'] = 'doc:patch';
    const _canvasOnly: CanvasMessage['type'] = 'node:click';
    expect([_editorOnly, _canvasOnly]).toHaveLength(2);
  });
});

describe('the last lines of defence', () => {
  it('createTransport refuses to post to the wildcard origin even if a channel asks it to', () => {
    const { editor, canvas } = pair();
    const transport = createTransport<EditorMessage, CanvasMessage>({
      host: editor,
      session: SESSION,
      acceptsOrigin: () => true,
      acceptsSource: () => true,
      parse: parseCanvasMessage,
      isOtherDirection: () => false,
      targets: () => [{ target: canvas.handle, origin: '*' }],
      accepted: () => {},
    });
    expect(() => transport.send('dnd:leave', {})).toThrow(/wildcard/);
    expect(canvas.posted).toHaveLength(0);
  });

  it('the canvas needs a window to listen on and a parent to talk to', () => {
    const { editor } = pair();
    const opts = { allowedOrigins: [EDITOR], session: SESSION };
    expect(() => createChildTransport({ ...opts, parent: editor.handle })).toThrow(/window/);
    expect(() => createChildTransport({ ...opts, host: new FakeWindow(CANVAS) })).toThrow(
      /not inside a frame/,
    );
  });
});
