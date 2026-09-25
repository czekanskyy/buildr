import type { Endpoint } from 'payload';
import { saveRequestSchema, saveResponseSchema } from '../../contract.ts';
import { processLayout } from '../hooks/process-layout.ts';
import { configuredLocales } from '../locales.ts';
import {
  allowed,
  bodyOf,
  type EndpointEnv,
  latestOf,
  revisionOf,
  targetOf,
  updatedBy,
  writeContext,
  writeLimit,
} from './context.ts';
import { mutationGuard } from './guards.ts';
import { conflict, fail, invalid, json } from './respond.ts';

/**
 * `PUT /api/buildr/documents/:collection/:id`: a save. The revision the editor built on must still
 * be the stored one (`409` otherwise); the document is migrated and validated (`422` with the
 * diagnostics); an autosave updates the current autosave version in place, a save creates a draft.
 */
export const saveEndpoint = (env: EndpointEnv): Endpoint => ({
  path: '/buildr/documents/:collection/:id',
  method: 'put',
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
    const parsed = saveRequestSchema.safeParse(body.value);
    if (!parsed.success) return fail(400, 'The request does not match the contract.');

    const found = await latestOf(req, target.value);
    if (!found.ok) return found.response;
    const current = revisionOf(found.value);
    if (parsed.data.baseRevision !== current) return conflict(current);

    const layout = processLayout(parsed.data.document, {
      ...env.options,
      locales: configuredLocales(req.payload.config),
    });
    if (!layout.ok) return invalid(layout.diagnostics);

    const updated = await req.payload.update({
      collection: target.value.collection,
      id: target.value.id,
      data: { layout: layout.doc, buildrRevision: current + 1, ...updatedBy(env, req) },
      draft: true,
      autosave: parsed.data.autosave,
      depth: 0,
      req,
      overrideAccess: false,
      context: writeContext(req),
    });
    return json(
      saveResponseSchema.parse({ revision: current + 1, updatedAt: String(updated['updatedAt']) }),
    );
  },
});
