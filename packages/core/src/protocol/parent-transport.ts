import { assertConcreteOrigin, assertSession } from './origins.ts';
import {
  type CanvasMessage,
  type EditorMessage,
  parseCanvasMessage,
  parseEditorMessage,
} from './parse.ts';
import { createTransport, type Transport, type TransportOptions } from './transport.ts';
import type { FrameLike, WindowLike } from './window-like.ts';

export interface ParentTransportOptions extends TransportOptions {
  /** The canvas `iframe`: only messages from its window are believed. */
  readonly iframe: FrameLike;
  /** The one origin the canvas is served from (`new URL(canvasUrl).origin`). Messages are addressed to it and accepted only from it. */
  readonly canvasOrigin: string;
  /** The nonce put in the canvas URL (`?session=`); every message carries it. */
  readonly session: string;
  /** The editor's own window, where `message` events arrive; `window` by default. */
  readonly host?: WindowLike;
}

/**
 * The editor's end of the channel (docs/editor.md#the-postmessage-protocol). Of every incoming
 * message it checks the origin, that the source is the frame's own window, the envelope, the
 * session, the protocol version and the schema, in that order, and drops what fails
 * (`onReject` says why). It posts only to `canvasOrigin`, never to `'*'`.
 */
export function createParentTransport(
  options: ParentTransportOptions,
): Transport<EditorMessage, CanvasMessage> {
  assertConcreteOrigin(options.canvasOrigin, 'canvasOrigin');
  assertSession(options.session);
  const host = options.host ?? (globalThis as unknown as { window?: WindowLike }).window;
  if (host === undefined) throw new Error('there is no window to listen on: pass `host`');
  const { iframe, canvasOrigin } = options;

  return createTransport<EditorMessage, CanvasMessage>(
    {
      host,
      session: options.session,
      acceptsOrigin: (origin) => origin === canvasOrigin,
      // Read at the time of each message: the frame's window is replaced when it navigates.
      acceptsSource: (source) =>
        source !== null && source !== undefined && source === iframe.contentWindow,
      parse: parseCanvasMessage,
      isOtherDirection: (input) => parseEditorMessage(input).ok,
      targets: () => {
        const target = iframe.contentWindow;
        return target === null ? [] : [{ target, origin: canvasOrigin }];
      },
      accepted: () => {},
    },
    options,
  );
}
