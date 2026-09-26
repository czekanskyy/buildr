// The parts of a browser window the transports use, as interfaces: `@next-buildr/core` has no DOM
// types and no ambient globals, so a window (or a test double) is handed in. `Window` satisfies
// all of these structurally.

/** What arrives with a `message` event. */
export interface MessageEventLike {
  readonly data: unknown;
  /** The origin of the window that sent it, as the browser reports it: not something the sender can forge. */
  readonly origin: string;
  /** The window that sent it, compared by identity with the one we expect. */
  readonly source: unknown;
}

/** A window that can be posted to. */
export interface PostTarget {
  postMessage(message: unknown, targetOrigin: string): void;
}

/** A window that receives `message` events: the editor's own, or the canvas's own. */
export interface WindowLike {
  addEventListener(type: 'message', listener: (event: MessageEventLike) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEventLike) => void): void;
}

/** The part of an `iframe` element the editor needs: the window inside it, which is `null` until it loads. */
export interface FrameLike {
  readonly contentWindow: PostTarget | null;
}

/** Timers, for the timeout of a request: `setTimeout` and `clearTimeout` of the environment. */
export interface Timers {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}
