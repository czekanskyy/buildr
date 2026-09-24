import type { Endpoint } from 'payload';
import { samplesResponseSchema } from '../../contract.ts';
import { chooseLocale } from '../locales.ts';
import { allowed, collectionOf, type EndpointEnv } from './context.ts';
import { fail, json } from './respond.ts';

const SAMPLE_LIMIT = 20;

/** `GET /api/buildr/samples/:collection?search`: documents to preview a template with. */
export const samplesEndpoint = (env: EndpointEnv): Endpoint => ({
  path: '/buildr/samples/:collection',
  method: 'get',
  handler: async (req) => {
    const collection = collectionOf(env, req);
    if (!collection.ok) return collection.response;
    if (!(await allowed(env, 'edit', req))) return fail(403, 'You may not edit with the builder.');
    const titleField =
      req.payload.collections[collection.value]?.config.admin?.useAsTitle ?? 'title';
    const locale = chooseLocale(req, req.searchParams?.get('locale'));
    if (!locale.ok) return locale.response;
    const search = req.searchParams?.get('search')?.trim() ?? '';
    const result = await req.payload.find({
      collection: collection.value,
      ...(search === '' ? {} : { where: { [titleField]: { like: search } } }),
      limit: SAMPLE_LIMIT,
      depth: 0,
      draft: true,
      ...locale.args,
      req,
      overrideAccess: false,
    });
    return json(
      samplesResponseSchema.parse({
        items: result.docs.map((doc) => {
          const record = doc as unknown as Record<string, unknown>;
          const title = record[titleField];
          return {
            id: String(record['id']),
            title: typeof title === 'string' && title !== '' ? title : String(record['id']),
          };
        }),
      }),
    );
  },
});
