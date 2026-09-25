import type { Endpoint, PayloadRequest, Where } from 'payload';
import {
  createDocumentRequestSchema,
  createDocumentResponseSchema,
  DOCUMENT_LIST_PAGE_SIZE,
  type DocumentSummary,
  documentListQuerySchema,
  documentListResponseSchema,
} from '../../contract.ts';
import { resolveLayout } from '../../data/index.ts';
import { isApiKeyRequest } from '../access.ts';
import {
  allowed,
  bodyOf,
  type EndpointEnv,
  mcpMayUse,
  revisionOf,
  updatedBy,
  writeContext,
  writeLimit,
} from './context.ts';
import { titleOf } from './document.ts';
import { mutationGuard } from './guards.ts';
import { fail, json, unauthorized } from './respond.ts';

const hasField = (req: PayloadRequest, collection: string, name: string): boolean =>
  req.payload.collections[collection]?.config.flattenedFields.some(
    (field) => field.name === name,
  ) === true;

async function summaryOf(
  env: EndpointEnv,
  req: PayloadRequest,
  collection: string,
  doc: Record<string, unknown>,
): Promise<DocumentSummary> {
  const own = env.options.collections[collection];
  const resolved = await resolveLayout({
    payload: req.payload,
    req,
    collection,
    doc,
    contextName: own?.context ?? collection,
    draft: true,
  });
  const id = doc['id'] as string | number;
  return {
    ref: { collection, id },
    title: titleOf(req, { collection, id: String(id) }, doc),
    slug: typeof doc['slug'] === 'string' ? doc['slug'] : null,
    status: doc['_status'] === 'published' ? 'published' : 'draft',
    updatedAt: String(doc['updatedAt'] ?? ''),
    revision: revisionOf(doc),
    layoutSource: resolved.source,
    previewPath: own?.path === undefined ? null : own.path(doc),
  };
}

/** The response to send when the collection is not a builder collection or an agent may not use it. */
function refuseCollection(
  env: EndpointEnv,
  req: PayloadRequest,
  collection: string,
): Response | undefined {
  if (env.options.collections[collection] === undefined) {
    return fail(404, `The collection "${collection}" was not found.`);
  }
  if (isApiKeyRequest(req) && !mcpMayUse(env, collection)) {
    return fail(403, `Agents may not use the collection "${collection}".`);
  }
  return undefined;
}

/** `GET /api/buildr/documents?collection&search&page`: the builder documents the user may read. */
export const listDocumentsEndpoint = (env: EndpointEnv): Endpoint => ({
  path: '/buildr/documents',
  method: 'get',
  handler: async (req) => {
    if (req.user === null || req.user === undefined) return unauthorized();
    if (!(await allowed(env, 'edit', req))) return fail(403, 'You may not edit with the builder.');
    const query = documentListQuerySchema.safeParse(Object.fromEntries(req.searchParams ?? []));
    if (!query.success) return fail(400, 'The query is not valid.');
    const { collection, search, page } = query.data;
    const refused = refuseCollection(env, req, collection);
    if (refused !== undefined) return refused;

    const titleField = req.payload.collections[collection]?.config.admin?.useAsTitle ?? 'title';
    const fields = [titleField, ...(hasField(req, collection, 'slug') ? ['slug'] : [])];
    const where: Where | undefined =
      search === undefined || search === ''
        ? undefined
        : { or: fields.map((name) => ({ [name]: { like: search } })) };
    const result = await req.payload.find({
      collection,
      draft: true,
      depth: 0,
      page,
      limit: DOCUMENT_LIST_PAGE_SIZE,
      sort: '-updatedAt',
      req,
      overrideAccess: false,
      ...(where === undefined ? {} : { where }),
    });
    const items = await Promise.all(
      result.docs.map((doc) => summaryOf(env, req, collection, doc as Record<string, unknown>)),
    );
    return json(
      documentListResponseSchema.parse({
        items,
        page: result.page ?? page,
        totalPages: result.totalPages,
      }),
    );
  },
});

/**
 * `POST /api/buildr/documents`: creates a draft in a builder collection (title, optional slug and
 * template). Collection access decides; the document is never published, whoever asks.
 */
export const createDocumentEndpoint = (env: EndpointEnv): Endpoint => ({
  path: '/buildr/documents',
  method: 'post',
  handler: async (req) => {
    if (req.user === null || req.user === undefined) return unauthorized();
    const rejected = mutationGuard(req);
    if (rejected !== undefined) return rejected;
    if (!(await allowed(env, 'edit', req))) return fail(403, 'You may not edit with the builder.');
    const limited = await writeLimit(env, req);
    if (limited !== undefined) return limited;
    const body = await bodyOf(req);
    if (!body.ok) return body.response;
    const parsed = createDocumentRequestSchema.safeParse(body.value);
    if (!parsed.success) return fail(400, 'The request does not match the contract.');
    const { collection, title, slug, template } = parsed.data;
    const refused = refuseCollection(env, req, collection);
    if (refused !== undefined) return refused;
    if (template !== undefined && env.options.collections[collection]?.templates !== true) {
      return fail(400, `The collection "${collection}" does not take templates.`);
    }
    if (slug !== undefined && !hasField(req, collection, 'slug')) {
      return fail(400, `The collection "${collection}" has no slug.`);
    }

    const titleField = req.payload.collections[collection]?.config.admin?.useAsTitle ?? 'title';
    try {
      const created = await req.payload.create({
        collection,
        data: {
          [titleField]: title,
          ...(slug === undefined ? {} : { slug }),
          ...(template === undefined ? {} : { template }),
          buildrRevision: 0,
          ...updatedBy(env, req),
        },
        draft: true,
        depth: 0,
        req,
        overrideAccess: false,
        context: writeContext(req),
      });
      const summary = await summaryOf(env, req, collection, created as Record<string, unknown>);
      return json(createDocumentResponseSchema.parse(summary), 201);
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 403) return fail(403, 'You may not create documents in this collection.');
      if (status === 400) {
        return fail(400, error instanceof Error ? error.message : 'The document is not valid.');
      }
      throw error;
    }
  },
});
