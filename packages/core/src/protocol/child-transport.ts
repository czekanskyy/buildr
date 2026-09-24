import { assertConcreteOrigin, assertSession } from './origins.ts';
import {
  type CanvasMessage,
  type EditorMessage,
  parseCanvasMessage,
  parseEditorMessage,
} from './parse.ts';
import { createTransport, type Transport, type TransportOptions } from './transport.ts';
import type { PostTarget, WindowLike } from './window-like.ts';

export interface ChildTransportOptions extends TransportOptions {
  /** The origins an editor may be served from. The first one that sends a valid message becomes the only one. */
  readonly allowedOrigins: readonly string[];
  /** The nonce from the canvas URL (`?session=`). */
  readonly session: string;
  /** The canvas's own window, where `message` events arrive; `window` by default. */
  readonly host?: WindowLike;
  /** The editor's window, `window.parent` by default. */
  readonly parent?: PostTarget;
}

/**
 * The canvas's end of the channel. It accepts messages only from its parent window and from an
 * allowed origin, checked as the editor's end checks the canvas. Until the editor has spoken it
 * does not know which allowed origin it is: it addresses each one in turn (the browser delivers
 * to the matching one only), and once a valid message has arrived it addresses that origin alone.
 * It never posts to `'*'`.
 */
export function createChildTransport(
  options: ChildTransportOptions,
): Transport<CanvasMessage, EditorMessage> {
  const allowed = [...new Set(options.allowedOrigins)];
  if (allowed.length === 0) throw new Error('allowedOrigins must name at least one origin');
  for (const origin of allowed) assertConcreteOrigin(origin, 'allowedOrigins');
  assertSession(options.session);

  const global = globalThis as unknown as { window?: WindowLike & { parent?: PostTarget } };
  const host = options.host ?? global.window;
  if (host === undefined) throw new Error('there is no window to listen on: pass `host`');
  const parent = options.parent ?? global.window?.parent;
  if (parent === undefined || (parent as unknown) === (host as unknown)) {
    throw new Error('the canvas is not inside a frame: there is no editor to talk to');
  }

  let peer: string | null = null;

  return createTransport<CanvasMessage, EditorMessage>(
    {
      host,
      session: options.session,
      acceptsOrigin: (origin) => allowed.includes(origin) && (peer === null || origin === peer),
      acceptsSource: (source) => source !== null && source !== undefined && source === parent,
      parse: parseEditorMessage,
      isOtherDirection: (input) => parseCanvasMessage(input).ok,
      targets: () =>
        peer === null
          ? allowed.map((origin) => ({ target: parent, origin }))
          : [{ target: parent, origin: peer }],
      accepted: (event) => {
        peer ??= event.origin;
      },
    },
    options,
  );
}
