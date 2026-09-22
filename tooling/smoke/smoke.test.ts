import { describe, expect, it } from 'vitest';

describe('repo toolchain', () => {
  it('runs a test through pnpm -> turbo -> vitest', () => {
    expect(1 + 1).toBe(2);
  });
});
