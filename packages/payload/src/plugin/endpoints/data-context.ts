import type { Endpoint } from 'payload';
import { dataContextQuerySchema, dataContextResponseSchema } from '../../contract.ts';
import { buildContext } from '../../data/index.ts';
import { chooseLocale } from '../locales.ts';
import { allowed, type EndpointEnv, latestOf, SITE_GLOBAL, schemaEnv } from './context.ts';
import { fail, json, notFound, unauthorized } from './respond.ts';

/**
 * `GET /api/buildr/data/context?collection&id&draft&locale`: the scopes the canvas binds against,
 * built with the access of the user who asks (`overrideAccess: false`), relations and uploads populated.
 */
export const dataContextEndpoint = (env: EndpointEnv): Endpoint => ({
  path: '/buildr/data/context',
  method: 'get',
  handler: async (req) => {
    if (req.user === null || req.user === undefined) return unauthorized();
    if (!(await allowed(env, 'edit', req))) return fail(403, 'You may not edit with the builder.');
    const parsed = dataContextQuerySchema.safeParse(
      Object.fromEntries(req.searchParams?.entries() ?? []),
    );
    if (!parsed.success) return fail(400, 'The query does not match the contract.');
    const { collection, id } = parsed.data;
    const locale = chooseLocale(req, parsed.data.locale);
    if (!locale.ok) return locale.response;
    const own = env.options.collections[collection];
    if (own === undefined) return notFound(`The collection "${collection}"`);

    const found = await latestOf(
      req,
      { collection, id },
      {
        depth: Math.max(1, own.depth),
        draft: parsed.data.draft !== '0',
        localeArgs: locale.args,
      },
    );
    if (!found.ok) return found.response;

    const { source, options } = schemaEnv(env, req);
    let site: Record<string, unknown> | undefined;
    if (source.globals?.some((global) => global.slug === SITE_GLOBAL) === true) {
      try {
        site = (await req.payload.findGlobal({
          slug: SITE_GLOBAL,
          depth: 1,
          req,
          overrideAccess: false,
          ...locale.args,
        })) as unknown as Record<string, unknown>;
      } catch {
        site = undefined; // the user may not read it: the scope is then null, not an error
      }
    }
    const path = own.path?.(found.value) ?? '';
    return json(
      dataContextResponseSchema.parse({
        scopes: buildContext({
          source,
          options,
          collection,
          doc: found.value,
          site,
          route: { path, locale: locale.locale ?? req.locale ?? '' },
        }),
      }),
    );
  },
});
