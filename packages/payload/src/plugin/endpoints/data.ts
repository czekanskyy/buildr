import type { Endpoint, PayloadRequest } from 'payload';
import {
  dataMediaRequestSchema,
  dataMediaResponseSchema,
  dataQueryRequestSchema,
  dataQueryResponseSchema,
} from '../../contract.ts';
import { createPayloadDataSource, DataQueryError } from '../../data/index.ts';
import { allowed, bodyOf, type EndpointEnv } from './context.ts';
import { mutationGuard } from './guards.ts';
import { fail, json, unauthorized } from './respond.ts';

/** The canvas source: reads with the access of the editing user, drafts included. */
function sourceOf(env: EndpointEnv, req: PayloadRequest) {
  const contextNames: Record<string, string> = {};
  for (const [slug, own] of Object.entries(env.options.collections)) {
    contextNames[slug] = own.context;
  }
  return createPayloadDataSource({
    payload: req.payload,
    req,
    queryable: env.options.queryable,
    mediaCollection: env.options.media?.collection,
    contextNames,
  });
}

/** The checks both endpoints share; `undefined` when the request may go on. */
async function guard(env: EndpointEnv, req: PayloadRequest): Promise<Response | undefined> {
  if (req.user === null || req.user === undefined) return unauthorized();
  const rejected = mutationGuard(req);
  if (rejected !== undefined) return rejected;
  if (!(await allowed(env, 'edit', req))) return fail(403, 'You may not edit with the builder.');
  return undefined;
}

/**
 * `POST /api/buildr/data/query {spec, locale?}`: what a `Query` binding resolves to in the canvas.
 * Only allowlisted collections, fields and sort keys (`options.queryable`) can be asked for.
 */
export const dataQueryEndpoint = (env: EndpointEnv): Endpoint => ({
  path: '/buildr/data/query',
  method: 'post',
  handler: async (req) => {
    const rejected = await guard(env, req);
    if (rejected !== undefined) return rejected;
    const body = await bodyOf(req);
    if (!body.ok) return body.response;
    const parsed = dataQueryRequestSchema.safeParse(body.value);
    if (!parsed.success) return fail(400, 'The request does not match the contract.');
    try {
      const result = await sourceOf(env, req).query(parsed.data.spec, {
        locale: parsed.data.locale ?? '',
        mode: 'canvas',
      });
      return json(dataQueryResponseSchema.parse(result));
    } catch (error) {
      if (error instanceof DataQueryError) return fail(422, error.message);
      throw error;
    }
  },
});

/** `POST /api/buildr/data/media {ids, locale?}`: media assets by id, as `{ [id]: MediaAsset }`. */
export const dataMediaEndpoint = (env: EndpointEnv): Endpoint => ({
  path: '/buildr/data/media',
  method: 'post',
  handler: async (req) => {
    const rejected = await guard(env, req);
    if (rejected !== undefined) return rejected;
    const body = await bodyOf(req);
    if (!body.ok) return body.response;
    const parsed = dataMediaRequestSchema.safeParse(body.value);
    if (!parsed.success) return fail(400, 'The request does not match the contract.');
    try {
      const found = await sourceOf(env, req).getMedia(parsed.data.ids, {
        locale: parsed.data.locale ?? '',
        mode: 'canvas',
      });
      return json(dataMediaResponseSchema.parse(found));
    } catch (error) {
      if (error instanceof DataQueryError) return fail(422, error.message);
      throw error;
    }
  },
});
