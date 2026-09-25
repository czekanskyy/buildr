import { ok, type RegistryMeta, type Theme, toManifest } from '@buildr/core';
import {
  createBuildrMcpServer,
  createBuildrTools,
  createDiscoveryCache,
  createResources,
  createSessionStore,
  type McpBackend,
  type McpTool,
  type SessionStore,
} from '@buildr/mcp';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { handleEndpoints, type Payload } from 'payload';
import { createMemoryRateLimiter, type RateLimiter } from '../plugin/forms/rate-limit.ts';
import { createPayloadMcpBackend } from './http-backend.ts';

/**
 * `@buildr/payload/mcp/route`: the remote MCP server of a site (ADR-024, docs/mcp.md). A Next.js
 * route handler over the SDK's Streamable HTTP transport in its stateless request/response mode.
 * It is the only file of `payload/mcp` that may import `payload`.
 */

export interface BuildrMcpRouteOptions {
  /** The Payload instance, or a function that returns it (`() => getPayload({ config })`). */
  readonly payload: Payload | (() => Promise<Payload>);
  /** The site's registry; its manifest is served when the plugin was configured without one. */
  readonly registry: { readonly meta: RegistryMeta };
  /** The site's theme (default: the default theme). */
  readonly theme?: Theme;
  /** Lets agents call `publish` (they still need `mcp.allowPublish` and `access.publish`). Default false. */
  readonly allowPublish?: boolean;
  /**
   * Origins (besides the site's own and Payload's `csrf` list) that may send a browser `Origin`
   * header. Clients without an `Origin` header (every MCP client that is not a web page) are unaffected.
   */
  readonly allowedOrigins?: readonly string[];
  /** The builder collections agents may list (default: every collection the plugin extended). */
  readonly collections?: readonly string[];
  /** Origin used to build preview URLs (default: the origin of the request). */
  readonly siteUrl?: string;
  /** Requests per authenticated user and window (default 120 per minute). */
  readonly rateLimit?: { readonly limit: number; readonly windowMs: number };
  /** Replaces the in-memory limiter (which does not span serverless instances). */
  readonly rateLimiter?: RateLimiter;
  /** Idle time after which a user's open documents are dropped (default 30 minutes). */
  readonly sessionTtlMs?: number;
  /** Largest accepted request body in bytes (default 1 MB). */
  readonly maxBodyBytes?: number;
}

export interface BuildrMcpRoute {
  readonly POST: (request: Request) => Promise<Response>;
  readonly GET: (request: Request) => Promise<Response>;
  readonly DELETE: (request: Request) => Promise<Response>;
}

const AUTHORIZATION = /^([A-Za-z0-9_-]{1,100}) API-Key (\S{8,512})$/;
const DEFAULT_SESSION_TTL_MS = 30 * 60_000;
const FAILURE_WINDOW_MS = 60_000;
const MAX_FAILURES = 30;

const reply = (status: number, error: string, headers: Record<string, string> = {}): Response =>
  new Response(
    JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: error }, id: null }),
    { status, headers: { 'content-type': 'application/json', ...headers } },
  );

const originOf = (value: string | null | undefined): string | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
};

/** What a user keeps between requests: the open documents and what serves them. */
interface UserEntry {
  readonly store: SessionStore;
  readonly backend: McpBackend;
  readonly tools: readonly McpTool[];
  readonly resources: ReturnType<typeof createResources>;
  /** The header the in-process backend sends; refreshed with every request of the user. */
  authorization: string;
  lastSeen: number;
}

/**
 * `createBuildrMcpRoute({ payload, registry })` returns the `POST`/`GET`/`DELETE` handlers of the
 * MCP endpoint. Mount them at `app/(builder)/api/buildr/mcp/route.ts`.
 *
 * - Disabled (`404`) unless the plugin has `mcp.enabled`.
 * - Only `Authorization: <collection> API-Key <key>` authenticates; cookies are never read (`401`),
 *   so a browser cannot drive the endpoint cross-site. A browser `Origin` must be the site's own,
 *   in Payload's `csrf` list or in `allowedOrigins`.
 * - The tools run against a local backend: the builder API of the same Payload, called in-process
 *   (no network hop) as the agent user, so Payload's access control, the plugin's `access`, the
 *   write limits and the revision checks apply exactly as over the network.
 * - Stateless: each request is one JSON-RPC exchange on a fresh server. Open documents live in a
 *   per-user session store held by this route (one per `createBuildrMcpRoute` call, never global);
 *   on serverless platforms it lives as long as the instance does, and an unknown session after a
 *   cold start is reported to the agent, which reopens the document.
 */
export function createBuildrMcpRoute(options: BuildrMcpRouteOptions): BuildrMcpRoute {
  const entries = new Map<string, UserEntry>();
  const sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  const maxBodyBytes = options.maxBodyBytes ?? 1_000_000;
  const limiter =
    options.rateLimiter ??
    createMemoryRateLimiter(options.rateLimit ?? { limit: 120, windowMs: 60_000 });
  // Clients that failed to authenticate too often are refused outright for a while.
  const failures = createMemoryRateLimiter({ limit: MAX_FAILURES, windowMs: FAILURE_WINDOW_MS });
  const blockedUntil = new Map<string, number>();
  let resolved: Promise<Payload> | undefined;
  const getPayload = (): Promise<Payload> => {
    if (typeof options.payload !== 'function') return Promise.resolve(options.payload);
    resolved ??= options.payload().catch((error: unknown) => {
      resolved = undefined;
      throw error;
    });
    return resolved;
  };

  const clientOf = (request: Request): string =>
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  function sweep(now: number): void {
    for (const [key, entry] of entries) {
      entry.store.sweep();
      if (entry.store.size === 0 && now - entry.lastSeen >= sessionTtlMs) entries.delete(key);
    }
    for (const [client, until] of blockedUntil) if (until <= now) blockedUntil.delete(client);
  }

  async function entryFor(
    payload: Payload,
    request: Request,
    key: string,
    collection: string,
    apiKey: string,
    authorization: string,
  ): Promise<UserEntry> {
    const existing = entries.get(key);
    if (existing !== undefined) {
      existing.authorization = authorization;
      existing.lastSeen = Date.now();
      return existing;
    }
    const site = options.siteUrl ?? new URL(request.url).origin;
    const apiRoot = payload.config.routes?.api ?? '/api';
    // Payload answers the builder API from memory; the header is the user's own key, refreshed per request.
    const holder: { entry?: UserEntry } = {};
    const inProcess: typeof fetch = (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set('authorization', holder.entry?.authorization ?? authorization);
      return handleEndpoints({
        config: payload.config,
        request: new Request(input, { ...init, headers }),
      });
    };
    const collections =
      options.collections ??
      payload.config.collections
        .filter((c) =>
          (c.fields as { name?: string }[]).some((field) => field.name === 'buildrRevision'),
        )
        .map((c) => c.slug);
    const http = createPayloadMcpBackend({
      baseUrl: `${site}${apiRoot}`,
      apiKey,
      collection,
      collections: [...collections],
      siteUrl: site,
      fetch: inProcess,
      retries: 0,
      ...(options.theme === undefined ? {} : { theme: options.theme }),
    });
    const backend: McpBackend = {
      ...http,
      async getManifest() {
        const served = await http.getManifest();
        if (served.ok || served.error.code !== 'not-found') return served;
        return ok(toManifest(options.registry.meta));
      },
    };
    const store = createSessionStore({ backend, ttlMs: sessionTtlMs });
    const discoveryCache = createDiscoveryCache();
    const tools = await createBuildrTools({
      store,
      backend,
      discoveryCache,
      allowPublish: options.allowPublish === true,
    });
    const entry: UserEntry = {
      store,
      backend,
      tools,
      resources: createResources(discoveryCache),
      authorization,
      lastSeen: Date.now(),
    };
    holder.entry = entry;
    entries.set(key, entry);
    return entry;
  }

  /** The route is off unless the plugin registered the agent endpoints (`mcp.enabled`). */
  const enabled = (payload: Payload): boolean =>
    (payload.config.endpoints ?? []).some((endpoint) => endpoint.path === '/buildr/documents');

  async function POST(request: Request): Promise<Response> {
    const payload = await getPayload();
    if (!enabled(payload)) return reply(404, 'Not found.');
    const now = Date.now();
    sweep(now);

    const origin = request.headers.get('origin');
    if (origin !== null) {
      const requested = originOf(origin);
      const allowed = new Set(
        [
          originOf(request.url),
          ...(payload.config.csrf ?? []).map(originOf),
          ...(options.allowedOrigins ?? []).map(originOf),
        ].filter((value): value is string => value !== undefined),
      );
      if (requested === undefined || !allowed.has(requested)) {
        return reply(403, 'The origin of the request is not allowed.');
      }
    }

    const client = clientOf(request);
    const until = blockedUntil.get(client);
    if (until !== undefined && until > now) {
      return reply(429, 'Too many failed attempts. Try again later.', {
        'retry-after': String(Math.ceil((until - now) / 1000)),
      });
    }
    // Cookies are never read here: a session cookie alone is not credentials.
    const deny = async (): Promise<Response> => {
      const failed = await failures.hit(client);
      if (!failed.allowed) blockedUntil.set(client, now + failed.retryAfterSeconds * 1000);
      return reply(401, 'Send an API key: Authorization: <collection> API-Key <key>.', {
        'www-authenticate': 'API-Key',
      });
    };

    const authorization = request.headers.get('authorization') ?? '';
    const match = AUTHORIZATION.exec(authorization);
    if (match === null) return deny();
    const collection = match[1] as string;
    const apiKey = match[2] as string;

    let user: { id?: string | number; collection?: string; _strategy?: string } | null;
    try {
      // Only the Authorization header is passed on, so Payload can only use the API-key strategy.
      const auth = await payload.auth({ headers: new Headers({ authorization }) });
      user = auth.user as typeof user;
    } catch {
      user = null;
    }
    if (
      user === null ||
      user === undefined ||
      user.id === undefined ||
      user._strategy !== 'api-key'
    ) {
      return deny();
    }

    const key = `${user.collection ?? collection}:${String(user.id)}`;
    const limit = await limiter.hit(key);
    if (!limit.allowed) {
      return reply(429, 'Too many requests. Try again later.', {
        'retry-after': String(limit.retryAfterSeconds),
      });
    }

    const declared = Number(request.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maxBodyBytes) {
      return reply(413, 'The request is too large.');
    }
    const body = await request.text();
    if (body.length > maxBodyBytes) return reply(413, 'The request is too large.');

    const entry = await entryFor(payload, request, key, collection, apiKey, authorization);
    const server = createBuildrMcpServer({
      backend: entry.backend,
      options: {
        tools: entry.tools,
        resources: entry.resources,
        allowPublish: options.allowPublish === true,
      },
    });
    // No session id generator: stateless mode.
    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
    });
    try {
      await server.connect(transport);
      return await transport.handleRequest(
        new Request(request.url, { method: 'POST', headers: request.headers, body }),
      );
    } finally {
      await server.close().catch(() => undefined);
    }
  }

  /** No server-initiated stream and no connection to end: the server is stateless. */
  async function notAllowed(): Promise<Response> {
    const payload = await getPayload();
    if (!enabled(payload)) return reply(404, 'Not found.');
    return reply(405, 'This MCP server only accepts POST.', { allow: 'POST' });
  }

  return { POST, GET: notAllowed, DELETE: notAllowed };
}
