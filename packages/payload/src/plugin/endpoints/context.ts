import type { PayloadRequest } from 'payload';
import type { SchemaOptions, SchemaSource } from '../../data/index.ts';
import { type Action, allowed as isAllowed } from '../access.ts';
import type { ResolvedOptions } from '../options.ts';
import { fail, notFound, unauthorized } from './respond.ts';

export interface DocumentTarget {
  readonly collection: string;
  readonly id: string;
}

/** Who may do what; decided per request. */
export interface EndpointEnv {
  readonly options: ResolvedOptions;
}

export type Guarded<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly response: Response };

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
    readonly locale?: string | undefined;
    readonly depth?: number;
    readonly draft?: boolean;
  } = {},
): Promise<Guarded<Record<string, unknown>>> {
  try {
    const doc = await req.payload.findByID({
      collection: target.collection,
      id: target.id,
      draft: options.draft ?? true,
      depth: options.depth ?? 0,
      req,
      overrideAccess: false,
      ...(options.locale === undefined ? {} : { locale: options.locale }),
    });
    return { ok: true, value: doc as unknown as Record<string, unknown> };
  } catch {
    return { ok: false, response: notFound(`The document "${target.collection}/${target.id}"`) };
  }
}

/** The stored revision of a document: 0 until the builder saved it. */
export const revisionOf = (doc: Record<string, unknown>): number =>
  typeof doc['buildrRevision'] === 'number' ? doc['buildrRevision'] : 0;
