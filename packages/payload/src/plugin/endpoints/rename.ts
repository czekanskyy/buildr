import type { Endpoint } from 'payload';
import { renameRequestSchema, renameResponseSchema } from '../../contract.ts';
import {
  allowed,
  bodyOf,
  type EndpointEnv,
  latestOf,
  targetOf,
  updatedBy,
  writeContext,
  writeLimit,
} from './context.ts';
import { mutationGuard } from './guards.ts';
import { fail, json } from './respond.ts';

/**
 * `PATCH /api/buildr/documents/:collection/:id`: renames a document. The name is the field the
 * collection shows as its title (`admin.useAsTitle`, else `title`); the layout and its revision are
 * left alone, so a rename never conflicts with the editor's own saves.
 */
export const renameEndpoint = (env: EndpointEnv): Endpoint => ({
  path: '/buildr/documents/:collection/:id',
  method: 'patch',
  handler: async (req) => {
    const target = targetOf(env, req);
    if (!target.ok) return target.response;
    const rejected = mutationGuard(req);
    if (rejected !== undefined) return rejected;
    if (!(await allowed(env, 'edit', req))) return fail(403, 'You may not edit with the builder.');
    const limited = await writeLimit(env, req);
    if (limited !== undefined) return limited;
    const body = await bodyOf(req);
    if (!body.ok) return body.response;
    const parsed = renameRequestSchema.safeParse(body.value);
    if (!parsed.success) return fail(400, 'The request does not match the contract.');

    const found = await latestOf(req, target.value);
    if (!found.ok) return found.response;

    const titleField =
      req.payload.collections[target.value.collection]?.config.admin?.useAsTitle ?? 'title';
    await req.payload.update({
      collection: target.value.collection,
      id: target.value.id,
      data: { [titleField]: parsed.data.title, ...updatedBy(env, req) },
      draft: true,
      depth: 0,
      req,
      overrideAccess: false,
      context: writeContext(req),
    });
    return json(renameResponseSchema.parse({ title: parsed.data.title }));
  },
});
