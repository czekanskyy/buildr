import type { JsonValue } from './json-value.ts';
import { stableStringify } from './stable-stringify.ts';

const FNV_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

interface TextEncoderLike {
  encode(input: string): Uint8Array;
}

// Typed narrowly instead of pulling in the DOM lib or `@types/node` (both forbidden/unavailable
// for `@buildr/core` — see docs/ai/architecture-rules.md #8); TextEncoder is a global in both
// Node and every modern browser.
function encodeUtf8(input: string): Uint8Array {
  const TextEncoderCtor = (globalThis as unknown as { TextEncoder: new () => TextEncoderLike })
    .TextEncoder;
  return new TextEncoderCtor().encode(input);
}

/** A stable FNV-1a (64-bit) hash of a `JsonValue`'s canonical form, base36-encoded. */
export function hash(value: JsonValue): string {
  let digest = FNV_OFFSET_BASIS;
  for (const byte of encodeUtf8(stableStringify(value))) {
    digest ^= BigInt(byte);
    digest = (digest * FNV_PRIME) & MASK_64;
  }
  return digest.toString(36);
}
