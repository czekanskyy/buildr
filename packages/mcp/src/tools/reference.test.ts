import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createMemoryBackend } from '../backends/memory.ts';
import { loadDefaultManifest } from '../serialize/default-manifest.test-kit.ts';
import { createSessionStore } from '../session/index.ts';
import { createBuildrTools } from './index.ts';
import { renderToolReference } from './reference.ts';

const DOC = new URL('../../../../docs/mcp.md', import.meta.url);
const START =
  '<!-- tool-reference:start (generated: UPDATE_MCP_DOCS=1 pnpm test --filter @next-buildr/mcp) -->';
const END = '<!-- tool-reference:end -->';

async function allTools() {
  const backend = createMemoryBackend({ manifest: loadDefaultManifest(), collections: ['pages'] });
  return createBuildrTools({
    store: createSessionStore({ backend }),
    backend,
    allowPublish: true,
  });
}

describe('docs/mcp.md tool reference', () => {
  it('lists every registered tool in a group', async () => {
    const tools = await allTools();
    expect(tools.map((tool) => tool.name)).toContain('publish');
    expect(renderToolReference(tools)).not.toContain('### Other');
  });

  it('is up to date (UPDATE_MCP_DOCS=1 regenerates it)', async () => {
    const generated = renderToolReference(await allTools());
    const doc = readFileSync(DOC, 'utf8');
    const start = doc.indexOf(START);
    const end = doc.indexOf(END);
    expect(start, 'start marker missing in docs/mcp.md').toBeGreaterThan(-1);
    expect(end, 'end marker missing in docs/mcp.md').toBeGreaterThan(start);
    const next = `${doc.slice(0, start + START.length)}\n\n${generated}\n${doc.slice(end)}`;
    if (process.env['UPDATE_MCP_DOCS'] === '1') {
      writeFileSync(DOC, next);
      return;
    }
    expect(
      doc,
      'the tool reference in docs/mcp.md is stale: run UPDATE_MCP_DOCS=1 pnpm test --filter @next-buildr/mcp',
    ).toBe(next);
  });
});
