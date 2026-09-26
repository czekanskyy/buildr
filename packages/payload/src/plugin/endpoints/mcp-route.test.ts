import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { runToolScenario } from '@next-buildr/mcp/testing';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createBuildrMcpRoute } from '../../mcp/route.ts';
import { boot, type Harness, meta } from './endpoints.test-kit.ts';

const KEY = 'agent-key-0123456789';
const URL_ = 'http://localhost/api/buildr/mcp';
let h: Harness;
const clients: Client[] = [];

beforeAll(async () => {
  h = await boot(
    'mcp-route',
    { mcp: { enabled: true, collections: ['pages'] } },
    { collections: [{ slug: 'users', auth: { useAPIKey: true }, fields: [] }] },
  );
  await h.payload.create({
    collection: 'users',
    data: {
      email: 'agent@example.com',
      password: 'secret-password',
      enableAPIKey: true,
      apiKey: KEY,
    },
  });
});
afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});
afterAll(() => h.close());

const makeRoute = (extra: Record<string, unknown> = {}) =>
  createBuildrMcpRoute({ payload: h.payload, registry: { meta }, ...extra });

async function connect(route = makeRoute(), headers: Record<string, string> = {}) {
  const transport = new StreamableHTTPClientTransport(new URL(URL_), {
    requestInit: { headers: { authorization: `users API-Key ${KEY}`, ...headers } },
    fetch: (input, init) => {
      const request = new Request(input, init);
      return request.method === 'POST' ? route.POST(request) : route.GET(request);
    },
  });
  const client = new Client({ name: 'http-test', version: '0.0.0' });
  clients.push(client);
  await client.connect(transport as Parameters<Client['connect']>[0]);
  return client;
}

const post = (route: ReturnType<typeof makeRoute>, headers: Record<string, string>) =>
  route.POST(
    new Request(URL_, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...headers,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    }),
  );

describe('the MCP route over Streamable HTTP', () => {
  it('runs the shared tool scenario as the agent user and saves a draft', async () => {
    const client = await connect();
    const { ref, revision } = await runToolScenario(client, {
      collection: 'pages',
      tree: { type: 'buildr/widget', props: { title: 'Hello from agent' } },
      expectText: 'Hello from agent',
    });
    expect(revision).toBeGreaterThan(0);
    const stored = (await h.payload.findByID({
      collection: 'pages',
      id: ref.id,
      draft: true,
    })) as unknown as {
      layout: { nodes: Record<string, { type: string }> };
      buildrUpdatedBy?: unknown;
    };
    expect(Object.values(stored.layout.nodes).map((node) => node.type)).toContain('buildr/widget');
    expect(stored.buildrUpdatedBy).toBeDefined();
  });

  it('keeps open documents between requests of the same user', async () => {
    const route = makeRoute();
    const first = await connect(route);
    const created = await first.callTool({
      name: 'create_document',
      arguments: { collection: 'pages', title: 'Kept' },
    });
    const sessionId = (created.structuredContent as { sessionId: string }).sessionId;
    // A different client (a new HTTP connection) of the same user continues the same working copy.
    const second = await connect(route);
    const outline = await second.callTool({ name: 'get_outline', arguments: { sessionId } });
    expect(outline.isError).not.toBe(true);
  });

  it('answers 401 without a key, with a wrong key and with only a session cookie', async () => {
    const route = makeRoute();
    expect((await post(route, {})).status).toBe(401);
    expect((await post(route, { authorization: 'users API-Key wrong-key-000000000' })).status).toBe(
      401,
    );
    expect((await post(route, { cookie: `payload-token=${h.token}` })).status).toBe(401);
    expect((await post(route, { authorization: `JWT ${h.token}` })).status).toBe(401);
    // Even next to a valid key a cookie is ignored, not used.
    expect(
      (
        await post(route, {
          authorization: `users API-Key ${KEY}`,
          cookie: `payload-token=${h.token}`,
        })
      ).status,
    ).toBe(200);
  });

  it('refuses a foreign browser origin and accepts the site itself', async () => {
    const route = makeRoute();
    const auth = { authorization: `users API-Key ${KEY}` };
    expect((await post(route, { ...auth, origin: 'https://evil.example' })).status).toBe(403);
    expect((await post(route, { ...auth, origin: 'http://localhost' })).status).toBe(200);
    const allowed = makeRoute({ allowedOrigins: ['https://claude.ai'] });
    expect((await post(allowed, { ...auth, origin: 'https://claude.ai' })).status).toBe(200);
  });

  it('is stateless: GET and DELETE are 405', async () => {
    const route = makeRoute();
    expect((await route.GET(new Request(URL_))).status).toBe(405);
    expect((await route.DELETE(new Request(URL_, { method: 'DELETE' }))).status).toBe(405);
  });

  it('rate limits per user', async () => {
    const route = makeRoute({ rateLimit: { limit: 2, windowMs: 60_000 } });
    const auth = { authorization: `users API-Key ${KEY}` };
    expect((await post(route, auth)).status).toBe(200);
    expect((await post(route, auth)).status).toBe(200);
    const limited = await post(route, auth);
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).not.toBeNull();
  });

  it('blocks a client that keeps failing to authenticate', async () => {
    const route = makeRoute();
    for (let n = 0; n < 31; n += 1) await post(route, { 'x-forwarded-for': '203.0.113.9' });
    const blocked = await post(route, {
      'x-forwarded-for': '203.0.113.9',
      authorization: `users API-Key ${KEY}`,
    });
    expect(blocked.status).toBe(429);
  });

  it('is disabled (404) when the plugin has no mcp.enabled', async () => {
    const off = createBuildrMcpRoute({
      payload: { config: { endpoints: [] } } as never,
      registry: { meta },
    });
    expect((await post(off, { authorization: `users API-Key ${KEY}` })).status).toBe(404);
    expect((await off.GET(new Request(URL_))).status).toBe(404);
  });
});
