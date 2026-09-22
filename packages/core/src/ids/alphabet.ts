export const ID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export const ID_LENGTH = 10;

// The smallest `2^n - 1` bitmask that covers the whole alphabet, so `byte & ALPHABET_MASK`
// only ever rejects the small tail above the alphabet's length instead of introducing
// modulo bias toward the low end of the alphabet.
const ALPHABET_MASK = (2 << (31 - Math.clz32(ID_ALPHABET.length - 1))) - 1;

/**
 * Turns a stream of random bytes into an `ID_LENGTH`-character `ID_ALPHABET` string via
 * rejection sampling. Shared by `generateId` (Web Crypto) and `createSeededIdGenerator`
 * (a deterministic PRNG) so both draw from the exact same, unbiased mapping.
 */
export function idFromRandomBytes(randomBytes: (size: number) => Uint8Array): string {
  // Oversized so a single call almost always yields ID_LENGTH accepted characters.
  const bufferSize = Math.ceil((ID_LENGTH * 1.6 * (ALPHABET_MASK + 1)) / ID_ALPHABET.length);
  let id = '';
  while (id.length < ID_LENGTH) {
    for (const byte of randomBytes(bufferSize)) {
      if (id.length === ID_LENGTH) break;
      const char = ID_ALPHABET[byte & ALPHABET_MASK];
      if (char !== undefined) id += char;
    }
  }
  return id;
}
