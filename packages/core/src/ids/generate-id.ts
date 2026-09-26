import { idFromRandomBytes } from './alphabet.ts';

export type IdGenerator = () => string;

interface WebCrypto {
  getRandomValues<T extends Uint8Array>(array: T): T;
}

// Typed narrowly instead of pulling in the DOM lib or `@types/node` (both forbidden/unavailable
// for `@next-buildr/core` — see docs/ai/architecture-rules.md #8); Web Crypto is a global in both
// Node and every modern browser.
function randomBytes(size: number): Uint8Array {
  const webCrypto = (globalThis as unknown as { crypto: WebCrypto }).crypto;
  return webCrypto.getRandomValues(new Uint8Array(size));
}

/** A random, base62, 10-character node ID (see docs/document-model.md). */
export function generateId(): string {
  return idFromRandomBytes(randomBytes);
}
