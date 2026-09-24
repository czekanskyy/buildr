import type { Endpoint } from 'payload';
import { dataSchemaResponseSchema } from '../../contract.ts';
import { schemaFromCollection } from '../../data/index.ts';
import { allowed, collectionOf, type EndpointEnv, schemaEnv } from './context.ts';
import { fail, json } from './respond.ts';

/** `GET /api/buildr/data-schema/:collection`: what the bindings of this collection's documents can reach. */
export const dataSchemaEndpoint = (env: EndpointEnv): Endpoint => ({
  path: '/buildr/data-schema/:collection',
  method: 'get',
  handler: async (req) => {
    const collection = collectionOf(env, req);
    if (!collection.ok) return collection.response;
    if (!(await allowed(env, 'edit', req))) return fail(403, 'You may not edit with the builder.');
    const { source, options } = schemaEnv(env, req);
    const schema = schemaFromCollection(source, collection.value, options);
    if (schema === undefined) return fail(404, `The collection "${collection.value}" has no data.`);
    return json(dataSchemaResponseSchema.parse(schema));
  },
});
