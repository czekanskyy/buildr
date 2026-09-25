import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, it } from 'vitest';
import { createBuildrMcpServerWithTools } from '../default-server.ts';
import { createTestMemoryBackend } from './fixtures.ts';
import { runToolScenario } from './scenario.ts';

const clients: Client[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

describe('runToolScenario', () => {
  it('passes over the in-memory transport', async () => {
    const { server } = await createBuildrMcpServerWithTools({ backend: createTestMemoryBackend() });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'scenario', version: '0.0.0' });
    clients.push(client);
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    await runToolScenario(client, { collection: 'pages' });
  });
});
