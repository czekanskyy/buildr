import type { PayloadRequest } from 'payload';
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

/** An authenticated user and a configured collection: what every document endpoint needs first. */
export function targetOf(env: EndpointEnv, req: PayloadRequest): Guarded<DocumentTarget> {
  if (req.user === null || req.user === undefined) return { ok: false, response: unauthorized() };
  const params = req.routeParams ?? {};
  const collection = params['collection'];
  const id = params['id'];
  if (typeof collection !== 'string' || typeof id !== 'string' || id === '') {
    return { ok: false, response: fail(400, 'A collection and an id are required.') };
  }
  if (env.options.collections[collection] === undefined) {
    return { ok: false, response: notFound(`The collection "${collection}"`) };
  }
  return { ok: true, value: { collection, id } };
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
  options: { readonly locale?: string | undefined } = {},
): Promise<Guarded<Record<string, unknown>>> {
  try {
    const doc = await req.payload.findByID({
      collection: target.collection,
      id: target.id,
      draft: true,
      depth: 0,
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
