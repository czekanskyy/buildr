import { readFileSync, writeFileSync } from 'node:fs';
import { toManifest } from '@buildr/core';
import { describe, expect, it } from 'vitest';
import { createDefaultRegistry } from './registry.ts';

// `@buildr/mcp` may not depend on this package (ADR-024), yet its serialization snapshots must run
// over every built-in component. The default manifest is therefore committed as plain JSON at
// packages/mcp/fixtures/default-manifest.json. This test keeps it current: run
// `UPDATE_MCP_FIXTURE=1 pnpm test --filter @buildr/components` after changing a component.
const env = (globalThis as { process?: { env: { UPDATE_MCP_FIXTURE?: string } } }).process?.env;
const fixture = new URL('../../mcp/fixtures/default-manifest.json', import.meta.url);

describe('the @buildr/mcp default manifest fixture', () => {
  it('matches the default registry', () => {
    const manifest = toManifest(createDefaultRegistry().meta);
    const text = `${JSON.stringify(manifest, null, 2)}\n`;
    if (env?.UPDATE_MCP_FIXTURE === '1') writeFileSync(fixture, text);
    expect(JSON.parse(readFileSync(fixture, 'utf8'))).toEqual(JSON.parse(text));
  });
});
