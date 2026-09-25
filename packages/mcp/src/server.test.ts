import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { createBuildrMcpServer, DEFAULT_INSTRUCTIONS, type McpTool } from './server.ts';
import { createTestMemoryBackend } from './testing/index.ts';
import { MCP_SERVER_VERSION } from './version.ts';

const clients: Client[] = [];

async function connect(tools?: readonly McpTool[], instructions?: string) {
  const server = createBuildrMcpServer({
    backend: createTestMemoryBackend(),
    options: { ...(tools ? { tools } : {}), ...(instructions ? { instructions } : {}) },
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  clients.push(client);
  return client;
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

describe('createBuildrMcpServer', () => {
  it('reports server info, capabilities and instructions to a connecting client', async () => {
    const client = await connect();
    expect(client.getServerVersion()).toMatchObject({
      name: 'buildr',
      version: MCP_SERVER_VERSION,
    });
    expect(client.getServerCapabilities()?.tools).toBeDefined();
    expect(client.getInstructions()).toBe(DEFAULT_INSTRUCTIONS);
  });

  it('serves an empty tool list by default', async () => {
    const client = await connect();
    expect((await client.listTools()).tools).toEqual([]);
  });

  it('accepts custom instructions', async () => {
    const client = await connect(undefined, 'Be brief.');
    expect(client.getInstructions()).toBe('Be brief.');
  });

  it('lists and calls provided tools with the backend in context', async () => {
    const tool: McpTool = {
      name: 'whoami',
      description: 'Returns the agent user.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      async handler(_args, { backend }) {
        const session = await backend.getSession();
        return {
          content: [{ type: 'text', text: session.ok ? String(session.value.user.id) : 'error' }],
        };
      },
    };
    const client = await connect([tool]);
    const listed = await client.listTools();
    expect(listed.tools[0]).toMatchObject({ name: 'whoami', annotations: { readOnlyHint: true } });
    const result = await client.callTool({ name: 'whoami', arguments: {} });
    expect(result.content).toEqual([{ type: 'text', text: 'memory-agent' }]);
  });

  it('rejects an unknown tool and hides the message of a throwing handler', async () => {
    const boom: McpTool = {
      name: 'boom',
      description: 'Throws.',
      inputSchema: { type: 'object' },
      async handler() {
        throw new Error('secret-key-123');
      },
    };
    const client = await connect([boom]);
    await expect(client.callTool({ name: 'missing', arguments: {} })).rejects.toThrow(
      /Unknown tool/,
    );
    const result = await client.callTool({ name: 'boom', arguments: {} });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain('secret-key-123');
  });

  it('refuses duplicate tool names', () => {
    const tool: McpTool = {
      name: 'a',
      description: '',
      inputSchema: { type: 'object' },
      handler: async () => ({ content: [] }),
    };
    expect(() =>
      createBuildrMcpServer({
        backend: createTestMemoryBackend(),
        options: { tools: [tool, tool] },
      }),
    ).toThrow(/duplicate/);
  });

  it('keeps the reported version equal to package.json', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      version: string;
    };
    expect(MCP_SERVER_VERSION).toBe(pkg.version);
  });
});
