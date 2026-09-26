import { describe, expect, it } from 'vitest';

// Verifies the `exports` convention from PB-002: every declared entry point of every
// workspace package resolves and imports cleanly, through real workspace dependencies
// (not relative paths), exactly as an external consumer would resolve them.
describe('package entry points', () => {
  it.each([
    ['@next-buildr/core', () => import('@next-buildr/core')],
    ['@next-buildr/core/commands', () => import('@next-buildr/core/commands')],
    ['@next-buildr/core/protocol', () => import('@next-buildr/core/protocol')],
    ['@next-buildr/react', () => import('@next-buildr/react')],
    ['@next-buildr/react/canvas', () => import('@next-buildr/react/canvas')],
    ['@next-buildr/components', () => import('@next-buildr/components')],
    ['@next-buildr/editor', () => import('@next-buildr/editor')],
    ['@next-buildr/next', () => import('@next-buildr/next')],
    ['@next-buildr/next/draft', () => import('@next-buildr/next/draft')],
    ['@next-buildr/next/canvas', () => import('@next-buildr/next/canvas')],
    ['@next-buildr/next/editor', () => import('@next-buildr/next/editor')],
    ['@next-buildr/mcp', () => import('@next-buildr/mcp')],
    ['@next-buildr/mcp/testing', () => import('@next-buildr/mcp/testing')],
    ['@next-buildr/payload/plugin', () => import('@next-buildr/payload/plugin')],
    ['@next-buildr/payload/data', () => import('@next-buildr/payload/data')],
    ['@next-buildr/payload/admin', () => import('@next-buildr/payload/admin')],
    ['@next-buildr/payload/adapter', () => import('@next-buildr/payload/adapter')],
    ['@next-buildr/payload/next', () => import('@next-buildr/payload/next')],
    ['@next-buildr/test-utils', () => import('@next-buildr/test-utils')],
  ] as const)('%s resolves and imports', async (_specifier, load) => {
    const mod = await load();
    expect(mod).toBeTypeOf('object');
  });

  it('resolves the @next-buildr/components/styles.css asset export', () => {
    const resolved = import.meta.resolve('@next-buildr/components/styles.css');
    expect(resolved).toMatch(/styles\.css$/);
  });
});
