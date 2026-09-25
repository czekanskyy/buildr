import { type Diagnostic, runA11y } from '@buildr/core';
import type { Endpoint } from 'payload';
import { publishRequestSchema, publishResponseSchema } from '../../contract.ts';
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
 * `POST /api/buildr/documents/:collection/:id/publish`: publishes the latest draft, all of it
 * (fields edited in the admin included). The revision must be the stored one (`409`); the layout is
 * validated again and, with `a11y.publish: 'block'`, accessibility errors refuse the publish (`422`).
 */
export const publishEndpoint = (env: EndpointEnv): Endpoint => ({
  path: '/buildr/documents/:collection/:id/publish',
  method: 'post',
  handler: async (req) => {
    const target = targetOf(env, req);
    if (!target.ok) return target.response;
    const rejected = mutationGuard(req);
    if (rejected !== undefined) return rejected;
    if (!(await allowed(env, 'publish', req))) {
      return fail(403, 'You may not publish with the builder.');
    }
    const limited = await writeLimit(env, req);
    if (limited !== undefined) return limited;
    const body = await bodyOf(req);
    if (!body.ok) return body.response;
    const parsed = publishRequestSchema.safeParse(body.value);
    if (!parsed.success) return fail(400, 'The request does not match the contract.');

    const found = await latestOf(req, target.value);
    if (!found.ok) return found.response;
    const current = revisionOf(found.value);
    if (parsed.data.baseRevision !== current) return conflict(current);

    const layout = processLayout(found.value['layout'], {
      ...env.options,
      locales: configuredLocales(req.payload.config),
    });
    if (!layout.ok) return invalid(layout.diagnostics);

    const registry = env.options.registry;
    if (registry !== undefined && env.options.a11y.publish === 'block') {
      const own = env.options.collections[target.value.collection];
      const errors: Diagnostic[] = runA11y(layout.doc, registry.meta, {
        config: { expectH1: own?.expectH1 === true ? 'document' : 'layout' },
      })
        .filter((issue) => issue.severity === 'error')
        .map((issue) => ({
          code: `a11y.${issue.ruleId}`,
          message: issue.message,
          severity: 'error',
          path: ['nodes', issue.nodeId],
        }));
      if (errors.length > 0) return invalid(errors);
    }

    const published = await req.payload.update({
      collection: target.value.collection,
      id: target.value.id,
      data: { _status: 'published', ...updatedBy(env, req) },
      draft: false,
      depth: 0,
      req,
      overrideAccess: false,
      context: writeContext(req),
    });
    const updatedAt = String(published['updatedAt']);
    return json(
      publishResponseSchema.parse({
        status: 'published',
        publishedAt: updatedAt,
        revision: current,
        updatedAt,
      }),
    );
  },
});
