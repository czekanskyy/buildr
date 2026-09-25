import type { PayloadRequest } from 'payload';
import type { SchemaOptions, SchemaSource } from '../../data/index.ts';
import { type Action, allowed as isAllowed, isApiKeyRequest } from '../access.ts';
import type { RateLimiter } from '../forms/rate-limit.ts';
import type { LocaleArgs } from '../locales.ts';
import type { ResolvedOptions } from '../options.ts';
import { BUILDR_WRITE } from '../write-guard.ts';
import { fail, notFound, unauthorized } from './respond.ts';

export interface DocumentTarget {
  readonly collection: string;
  readonly id: string;
}

/** Who may do what; decided per request. */
export interface EndpointEnv {
  readonly options: ResolvedOptions;
  /** Limits form submissions (present when forms are enabled). */
  readonly rateLimiter?: RateLimiter | undefined;
  /** Limits the writes of API-key requests (present when `mcp.enabled`). */
  readonly writeLimiter?: RateLimiter | undefined;
}

export type Guarded<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly response: Response };

/** Whether an API-key user may use the builder collection (`mcp.collections`; default: all of them). */
export const mcpMayUse = (env: EndpointEnv, collection: string): boolean =>
  env.options.collections[collection] !== undefined &&
  (env.options.mcp.collections === undefined || env.options.mcp.collections.includes(collection));

/**
 * The write rate limit of API-key requests (browser sessions are not limited): the response to send
 * instead (`429`), or `undefined`.
 */
export async function writeLimit(
  env: EndpointEnv,
  req: PayloadRequest,
): Promise<Response | undefined> {
  if (!isApiKeyRequest(req) || env.writeLimiter === undefined) return undefined;
  const user = req.user as { id?: string | number; collection?: string };
  const result = await env.writeLimiter.hit(`${user.collection ?? ''}:${String(user.id)}`);
  if (result.allowed) return undefined;
  const response = fail(429, 'Too many writes. Try again later.');
  response.headers.set('retry-after', String(result.retryAfterSeconds));
  return response;
}

/** The context of every builder write: the guard flag, and whether an API key made the request. */
export const writeContext = (req: PayloadRequest): Record<string, unknown> => ({
  [BUILDR_WRITE]: true,
  ...(isApiKeyRequest(req) ? { buildrApiKey: true } : {}),
});

/**
 * The user a write is attributed to (`buildrUpdatedBy`, added with `mcp.enabled`); it lands in the
 * document and in every version, so history shows the agent's user.
 */
export function updatedBy(env: EndpointEnv, req: PayloadRequest): Record<string, unknown> {
  const user = req.user as { id?: string | number; collection?: string } | null | undefined;
  if (!env.options.mcp.enabled || user?.id === undefined || user.collection === undefined) {
    return {};
  }
  return { buildrUpdatedBy: { relationTo: user.collection, value: user.id } };
}

/** An authenticated user and a configured collection (the `:collection` param). */
export function collectionOf(env: EndpointEnv, req: PayloadRequest): Guarded<string> {
  if (req.user === null || req.user === undefined) return { ok: false, response: unauthorized() };
  const collection = req.routeParams?.['collection'];
  if (typeof collection !== 'string' || collection === '') {
    return { ok: false, response: fail(400, 'A collection is required.') };
  }
  if (env.options.collections[collection] === undefined) {
    return { ok: false, response: notFound(`The collection "${collection}"`) };
  }
  if (isApiKeyRequest(req) && !mcpMayUse(env, collection)) {
    return { ok: false, response: fail(403, `Agents may not use the collection "${collection}".`) };
  }
  return { ok: true, value: collection };
}

/** An authenticated user and a configured collection with an id: what every document endpoint needs first. */
export function targetOf(env: EndpointEnv, req: PayloadRequest): Guarded<DocumentTarget> {
  const collection = collectionOf(env, req);
  if (!collection.ok) return collection;
  const id = req.routeParams?.['id'];
  if (typeof id !== 'string' || id === '') {
    return { ok: false, response: fail(400, 'A collection and an id are required.') };
  }
  return { ok: true, value: { collection: collection.value, id } };
}

/** The global that becomes the `site` scope. */
export const SITE_GLOBAL = 'site-settings';

/** What the schema and the context derive from: the live Payload config and the plugin names. */
export function schemaEnv(
  env: EndpointEnv,
  req: PayloadRequest,
): { source: SchemaSource; options: SchemaOptions } {
  const config = req.payload.config;
  const contextNames: Record<string, string> = {};
  for (const [slug, own] of Object.entries(env.options.collections)) {
    contextNames[slug] = own.context;
  }
  return {
    source: {
      collections: config.collections as unknown as SchemaSource['collections'],
      globals: (config.globals ?? []) as unknown as NonNullable<SchemaSource['globals']>,
    },
    options: { contextNames, siteGlobal: SITE_GLOBAL },
  };
}

/** The JSON body of a request, or a `400` for anything else. */
export async function bodyOf(req: PayloadRequest): Promise<Guarded<unknown>> {
  try {
    return { ok: true, value: await req.json?.() };
  } catch {
    return { ok: false, response: fail(400, 'The request body must be JSON.') };
  }
}

/** Whether the user of `req` may `action` (see `plugin/access.ts`). */
export const allowed = (env: EndpointEnv, action: Action, req: PayloadRequest): Promise<boolean> =>
  isAllowed(env.options, action, req);

/** Loads the latest draft of the target, or the response to send instead (`404`). */
export async function latestOf(
  req: PayloadRequest,
  target: DocumentTarget,
  options: {
    readonly localeArgs?: LocaleArgs | undefined;
    readonly depth?: number;
    readonly draft?: boolean;
    /** Only these fields are read (Payload's `select`). */
    readonly select?: Record<string, true>;
  } = {},
): Promise<Guarded<Record<string, unknown>>> {
  try {
    const doc = await req.payload.findByID({
      collection: target.collection,
      id: target.id,
      draft: options.draft ?? true,
      depth: options.depth ?? 0,
      ...(options.select === undefined ? {} : { select: options.select }),
      req,
      overrideAccess: false,
      ...options.localeArgs,
    });
    return { ok: true, value: doc as unknown as Record<string, unknown> };
  } catch {
    return { ok: false, response: notFound(`The document "${target.collection}/${target.id}"`) };
  }
}

/** The stored revision of a document: 0 until the builder saved it. */
export const revisionOf = (doc: Record<string, unknown>): number =>
  typeof doc['buildrRevision'] === 'number' ? doc['buildrRevision'] : 0;
