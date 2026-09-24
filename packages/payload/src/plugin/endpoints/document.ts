import type { Endpoint, PayloadRequest } from 'payload';
import {
  type DocumentResponse,
  documentQuerySchema,
  documentResponseSchema,
} from '../../contract.ts';
import { resolveLayout } from '../../data/index.ts';
import { readLayout } from '../hooks/read-layout.ts';
import {
  allowed,
  type DocumentTarget,
  type EndpointEnv,
  latestOf,
  revisionOf,
  targetOf,
} from './context.ts';
import { fail, invalid, json } from './respond.ts';

const titleOf = (req: PayloadRequest, target: DocumentTarget, doc: Record<string, unknown>) => {
  const field = req.payload.collections[target.collection]?.config.admin?.useAsTitle ?? 'title';
  const value = doc[field];
  return typeof value === 'string' && value !== '' ? value : target.id;
};

/** `GET /api/buildr/documents/:collection/:id`: the document the editor opens, migrated in memory. */
export const getDocumentEndpoint = (env: EndpointEnv): Endpoint => ({
  path: '/buildr/documents/:collection/:id',
  method: 'get',
  handler: async (req) => {
    const target = targetOf(env, req);
    if (!target.ok) return target.response;
    if (!(await allowed(env, 'edit', req))) return fail(403, 'You may not edit with the builder.');
    const query = documentQuerySchema.safeParse(Object.fromEntries(req.searchParams ?? []));
    if (!query.success) return fail(400, 'The query is not valid.');

    const found = await latestOf(req, target.value, { locale: query.data.locale });
    if (!found.ok) return found.response;
    const doc = found.value;
    const own = env.options.collections[target.value.collection];
    const resolved = await resolveLayout({
      payload: req.payload,
      req,
      collection: target.value.collection,
      doc,
      contextName: own?.context ?? target.value.collection,
      draft: true,
    });
    // A blank canvas for a document nobody gave a layout: the built-in one is only a render fallback.
    const layout = readLayout(
      resolved.source === 'builtin' ? undefined : resolved.layout,
      env.options,
    );
    if (!layout.ok) return invalid(layout.diagnostics);

    const path = own?.path;
    const body: DocumentResponse = {
      ref: target.value,
      title: titleOf(req, target.value, doc),
      slug: typeof doc['slug'] === 'string' ? doc['slug'] : null,
      status: doc['_status'] === 'published' ? 'published' : 'draft',
      updatedAt: String(doc['updatedAt'] ?? ''),
      revision: revisionOf(doc),
      document: layout.doc,
      contextRef: `${target.value.collection}:${target.value.id}`,
      layoutSource: resolved.source,
      layoutRef: resolved.layoutRef,
      previewPath: path === undefined ? null : path(doc),
      ...(layout.readOnly ? { readOnly: true } : {}),
    };
    return json(documentResponseSchema.parse(body));
  },
});
