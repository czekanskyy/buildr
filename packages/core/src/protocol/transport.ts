import type { Diagnostic } from '../result/diagnostic.ts';
import type { CanvasMessage, EditorMessage, Message, MessageType, PayloadOf } from './parse.ts';
import { createMessage, parseEnvelope } from './parse.ts';
import { PROTOCOL_VERSION } from './version.ts';
import type { MessageEventLike, PostTarget, Timers, WindowLike } from './window-like.ts';

/** Why an incoming message was dropped. Each is one check of docs/security.md#postmessage. */
export type RejectReason =
  /** Sent from an origin that is not the expected one. */
  | 'origin'
  /** Sent from a window other than the expected one (another frame, a popup). */
  | 'source'
  /** Not an envelope of ours at all. */
  | 'envelope'
  /** From another session: a stale frame, or a guess. */
  | 'session'
  /** From another protocol version. */
  | 'version'
  /** Not a message the protocol knows, or one whose payload is malformed. */
  | 'schema'
  /** A valid message, of a type the peer may not send. */
  | 'direction'
  /** The answer to a request that is no longer waiting (it timed out or was never made). */
  | 'stale-reply';

export interface Rejection {
  readonly reason: RejectReason;
  /** The origin it came from, for the log. */
  readonly origin: string;
  /** Set for `schema`, `envelope` and `direction`: what was wrong, in one line. */
  readonly diagnostic?: Diagnostic;
  /** Set for `version`: the version the peer speaks. */
  readonly protocol?: number;
}

/** Thrown into a pending request when it can no longer be answered. */
export class TransportError extends Error {
  readonly code: 'timeout' | 'closed';
  constructor(code: 'timeout' | 'closed', message: string) {
    super(message);
    this.name = 'TransportError';
    this.code = code;
  }
}

export const DEFAULT_REQUEST_TIMEOUT_MS = 5000;

export interface TransportOptions {
  /** Called with every message that was dropped, so a development build can log why. */
  readonly onReject?: (rejection: Rejection) => void;
  /** Called when a handler throws; without it the error is rethrown from a timer, so it is reported and not lost. */
  readonly onError?: (error: unknown) => void;
  /** Timers for request timeouts; the environment's by default. */
  readonly timers?: Timers;
  /** How long a request waits for its answer. */
  readonly requestTimeoutMs?: number;
}

export interface RequestOptions {
  readonly timeoutMs?: number;
}

/**
 * One end of the editor-canvas channel. `Out` is what this side may send and `In` what it may
 * receive; both are message types, so a typo or a message from the wrong side is a type error.
 */
export interface Transport<OutMessage extends Message, InMessage extends Message> {
  /** Sends a message; `false` when there is nowhere to send it yet (the frame has no window). */
  send<T extends OutMessage['type']>(
    type: T,
    payload: PayloadOf<T & MessageType>,
    options?: { readonly replyTo?: string },
  ): boolean;
  /** Sends a message that wants an answer, and resolves with the answer, or rejects with a `TransportError` after the timeout. */
  request<T extends OutMessage['type']>(
    type: T,
    payload: PayloadOf<T & MessageType>,
    options?: RequestOptions,
  ): Promise<InMessage>;
  /** Answers `to`, which must have been sent as a request. */
  reply<T extends OutMessage['type']>(
    to: { readonly id?: string | undefined },
    type: T,
    payload: PayloadOf<T & MessageType>,
  ): boolean;
  /** Listens for messages of one type. Returns the function that stops listening. */
  on<T extends InMessage['type']>(
    type: T,
    handler: (
      payload: PayloadOf<T & MessageType>,
      message: Extract<InMessage, { type: T }>,
    ) => void,
  ): () => void;
  /** Stops listening and fails every pending request. Idempotent. */
  close(): void;
}

/** What differs between the two ends: who to trust, and where to send. */
export interface Channel<InMessage extends Message> {
  readonly host: WindowLike;
  readonly session: string;
  /** Whether messages from `origin` are acceptable now. */
  acceptsOrigin(origin: string): boolean;
  /** Whether `source` is the one window messages may come from. */
  acceptsSource(source: unknown): boolean;
  /** Reads a message of the direction this end receives. */
  parse(input: unknown): { ok: true; value: InMessage } | { ok: false; error: Diagnostic };
  /** Whether `input` is a valid message of the other direction (to tell a wrong-way message from garbage). */
  isOtherDirection(input: unknown): boolean;
  /** Where a message goes now: a window and the one origin to address it to, never `'*'`. */
  targets(): readonly { readonly target: PostTarget; readonly origin: string }[];
  /** Called with a message that passed every check. */
  accepted(event: MessageEventLike): void;
}

/** The single place a message is posted: it refuses the wildcard origin whatever the caller did. */
function post(target: PostTarget, message: unknown, origin: string): void {
  if (origin === '*') throw new Error('refusing to post a message with the wildcard target origin');
  target.postMessage(message, origin);
}

function defaultTimers(): Timers {
  const g = globalThis as unknown as Timers;
  return { setTimeout: (cb, ms) => g.setTimeout(cb, ms), clearTimeout: (h) => g.clearTimeout(h) };
}

interface Pending {
  readonly resolve: (message: never) => void;
  readonly reject: (error: TransportError) => void;
  readonly timer: unknown;
}

/**
 * The shared machinery of both ends: it checks every incoming message in a fixed order (origin,
 * source, envelope, session, version, schema, direction), routes replies to their requests and the
 * rest to the handlers of their type, and posts only to a concrete origin.
 */
export function createTransport<OutMessage extends Message, InMessage extends Message>(
  channel: Channel<InMessage>,
  options: TransportOptions = {},
): Transport<OutMessage, InMessage> {
  const timers = options.timers ?? defaultTimers();
  const handlers = new Map<string, Set<(payload: never, message: never) => void>>();
  const pending = new Map<string, Pending>();
  let counter = 0;
  let closed = false;

  const reject = (rejection: Rejection) => options.onReject?.(rejection);

  const fail = (error: unknown) => {
    if (options.onError !== undefined) options.onError(error);
    else
      timers.setTimeout(() => {
        throw error;
      }, 0);
  };

  const listener = (event: MessageEventLike) => {
    if (closed) return;
    const origin = typeof event.origin === 'string' ? event.origin : '';
    if (!channel.acceptsOrigin(origin)) return reject({ reason: 'origin', origin });
    if (!channel.acceptsSource(event.source)) return reject({ reason: 'source', origin });

    const envelope = parseEnvelope(event.data);
    if (!envelope.ok) return reject({ reason: 'envelope', origin, diagnostic: envelope.error });
    if (envelope.value.session !== channel.session) return reject({ reason: 'session', origin });
    if (envelope.value.protocol !== PROTOCOL_VERSION) {
      return reject({ reason: 'version', origin, protocol: envelope.value.protocol });
    }

    const parsed = channel.parse(event.data);
    if (!parsed.ok) {
      return reject(
        channel.isOtherDirection(event.data)
          ? { reason: 'direction', origin, diagnostic: parsed.error }
          : { reason: 'schema', origin, diagnostic: parsed.error },
      );
    }
    const message = parsed.value;
    channel.accepted(event);

    if (message.replyTo !== undefined) {
      const waiting = pending.get(message.replyTo);
      if (waiting === undefined) return reject({ reason: 'stale-reply', origin });
      pending.delete(message.replyTo);
      timers.clearTimeout(waiting.timer);
      waiting.resolve(message as never);
      return;
    }

    for (const handler of [...(handlers.get(message.type) ?? [])]) {
      try {
        handler(message.payload as never, message as never);
      } catch (error) {
        fail(error);
      }
    }
  };

  channel.host.addEventListener('message', listener);

  const sendMessage = (
    type: string,
    payload: unknown,
    extra: { id?: string; replyTo?: string },
  ) => {
    if (closed) return false;
    const targets = channel.targets();
    if (targets.length === 0) return false;
    const message = createMessage(type as MessageType, payload as never, {
      session: channel.session,
      ...extra,
    });
    for (const { target, origin } of targets) post(target, message, origin);
    return true;
  };

  return {
    send: (type, payload, opts) =>
      sendMessage(type, payload, opts?.replyTo === undefined ? {} : { replyTo: opts.replyTo }),

    request: (type, payload, opts) =>
      new Promise((resolve, reject_) => {
        if (closed) return reject_(new TransportError('closed', 'the transport is closed'));
        const id = `r${++counter}`;
        const ms = opts?.timeoutMs ?? options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
        const timer = timers.setTimeout(() => {
          pending.delete(id);
          reject_(new TransportError('timeout', `no answer to "${type}" within ${ms} ms`));
        }, ms);
        pending.set(id, { resolve: resolve as (m: never) => void, reject: reject_, timer });
        if (!sendMessage(type, payload, { id })) {
          pending.delete(id);
          timers.clearTimeout(timer);
          reject_(new TransportError('closed', 'there is no window to send to'));
        }
      }),

    reply: (to, type, payload) =>
      to.id === undefined ? false : sendMessage(type, payload, { replyTo: to.id }),

    on: (type, handler) => {
      const set = handlers.get(type) ?? new Set();
      set.add(handler as (payload: never, message: never) => void);
      handlers.set(type, set);
      return () => {
        set.delete(handler as (payload: never, message: never) => void);
      };
    },

    close: () => {
      if (closed) return;
      closed = true;
      channel.host.removeEventListener('message', listener);
      for (const [id, waiting] of pending) {
        timers.clearTimeout(waiting.timer);
        waiting.reject(new TransportError('closed', 'the transport was closed'));
        pending.delete(id);
      }
      handlers.clear();
    },
  };
}

export type { CanvasMessage, EditorMessage };
