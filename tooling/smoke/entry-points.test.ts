import { describe, expect, it } from 'vitest';

// Verifies the `exports` convention from PB-002: every declared entry point of every
// workspace package resolves and imports cleanly, through real workspace dependencies
// (not relative paths), exactly as an external consumer would resolve them.
describe('package entry points', () => {
  it.each([
    ['@buildr/core', () => import('@buildr/core')],
    ['@buildr/core/commands', () => import('@buildr/core/commands')],
    ['@buildr/core/protocol', () => import('@buildr/core/protocol')],
    ['@buildr/react', () => import('@buildr/react')],
    ['@buildr/react/canvas', () => import('@buildr/react/canvas')],
    ['@buildr/components', () => import('@buildr/components')],
    ['@buildr/editor', () => import('@buildr/editor')],
    ['@buildr/next', () => import('@buildr/next')],
    ['@buildr/next/draft', () => import('@buildr/next/draft')],
    ['@buildr/next/canvas', () => import('@buildr/next/canvas')],
    ['@buildr/next/editor', () => import('@buildr/next/editor')],
    ['@buildr/payload/plugin', () => import('@buildr/payload/plugin')],
    ['@buildr/payload/data', () => import('@buildr/payload/data')],
    ['@buildr/payload/admin', () => import('@buildr/payload/admin')],
    ['@buildr/payload/adapter', () => import('@buildr/payload/adapter')],
    ['@buildr/payload/next', () => import('@buildr/payload/next')],
    ['@buildr/test-utils', () => import('@buildr/test-utils')],
  ] as const)('%s resolves and imports', async (_specifier, load) => {
    const mod = await load();
    expect(mod).toBeTypeOf('object');
  });

  it('resolves the @buildr/components/styles.css asset export', () => {
    const resolved = import.meta.resolve('@buildr/components/styles.css');
    expect(resolved).toMatch(/styles\.css$/);
  });
});
