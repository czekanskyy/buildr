import { SESSION_PATTERN } from './envelope.ts';

// scheme://host[:port], where host is a name, an IPv4 address or a bracketed IPv6 address. No
// path, query, credentials or wildcard: exactly what `event.origin` and a `targetOrigin` look like.
const ORIGIN =
  /^https?:\/\/(?:[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?|\[[0-9A-Fa-f:.]+\])(?::\d{1,5})?$/;

/**
 * Checks that `origin` is a concrete origin a message can be addressed to and trusted from. `'*'`,
 * `'null'` (an opaque origin, which any sandboxed frame has), a URL with a path and the like are
 * refused: a misconfigured allowlist must fail loudly at start, not open the channel.
 */
export function assertConcreteOrigin(origin: string, what: string): void {
  if (typeof origin !== 'string' || !ORIGIN.test(origin)) {
    throw new Error(
      `${what} must be an origin such as "https://editor.example.com", not ${JSON.stringify(origin)}`,
    );
  }
}

/** Refuses a session that could not have been minted by the editor (too short to be a nonce). */
export function assertSession(session: string): void {
  if (typeof session !== 'string' || !SESSION_PATTERN.test(session)) {
    throw new Error('the session must be 16 to 128 URL-safe characters');
  }
}
