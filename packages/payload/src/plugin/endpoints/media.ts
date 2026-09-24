import type { Endpoint, PayloadRequest } from 'payload';
import { mediaListQuerySchema, mediaListResponseSchema } from '../../contract.ts';
import { normalizeMedia } from '../../data/index.ts';
import { chooseLocale } from '../locales.ts';
import { allowed, type EndpointEnv } from './context.ts';
import { mutationGuard } from './guards.ts';
import { fail, json, unauthorized } from './respond.ts';

const PAGE_SIZE = 24;
/** Uploads are buffered by the server; a serverless host may impose a lower limit of its own. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const TYPE_PREFIX = { image: 'image/', video: 'video/', audio: 'audio/' } as const;

/** The media collection, or the response to send when the builder has none or the caller may not edit. */
async function mediaOf(
  env: EndpointEnv,
  req: PayloadRequest,
): Promise<{ ok: true; slug: string } | { ok: false; response: Response }> {
  if (req.user === null || req.user === undefined) return { ok: false, response: unauthorized() };
  const slug = env.options.media?.collection;
  if (slug === undefined || req.payload.collections[slug] === undefined) {
    return { ok: false, response: fail(404, 'No media collection is configured.') };
  }
  if (!(await allowed(env, 'edit', req))) {
    return { ok: false, response: fail(403, 'You may not edit with the builder.') };
  }
  return { ok: true, slug };
}

/** `GET /api/buildr/media?search&type&page`: the picker's listing, newest first. */
export const mediaListEndpoint = (env: EndpointEnv): Endpoint => ({
  path: '/buildr/media',
  method: 'get',
  handler: async (req) => {
    const media = await mediaOf(env, req);
    if (!media.ok) return media.response;
    const parsed = mediaListQuerySchema.safeParse({
      search: req.searchParams?.get('search') ?? undefined,
      type: req.searchParams?.get('type') ?? undefined,
      page: req.searchParams?.get('page') ?? undefined,
      locale: req.searchParams?.get('locale') ?? undefined,
    });
    if (!parsed.success) return fail(400, 'The query does not match the contract.');
    const { search, type, page } = parsed.data;
    const locale = chooseLocale(req, parsed.data.locale);
    if (!locale.ok) return locale.response;
    const conditions = [
      ...(search === undefined || search === ''
        ? []
        : [{ or: [{ alt: { like: search } }, { filename: { like: search } }] }]),
      ...(type === undefined ? [] : [{ mimeType: { like: TYPE_PREFIX[type] } }]),
    ];
    const result = await req.payload.find({
      collection: media.slug,
      ...(conditions.length === 0 ? {} : { where: { and: conditions } }),
      sort: '-createdAt',
      page,
      limit: PAGE_SIZE,
      depth: 0,
      ...locale.args,
      req,
      overrideAccess: false,
    });
    return json(
      mediaListResponseSchema.parse({
        items: result.docs.flatMap((doc) => {
          const asset = normalizeMedia(doc);
          return asset === null ? [] : [asset];
        }),
        page: result.page ?? page,
        totalPages: result.totalPages,
      }),
    );
  },
});

/** `POST /api/buildr/media` (multipart `file`, `alt`): uploads through the Local API; `alt` is required. */
export const mediaUploadEndpoint = (env: EndpointEnv): Endpoint => ({
  path: '/buildr/media',
  method: 'post',
  handler: async (req) => {
    const media = await mediaOf(env, req);
    if (!media.ok) return media.response;
    const rejected = mutationGuard(req, 'multipart');
    if (rejected !== undefined) return rejected;

    let form: FormData;
    try {
      form = await (req as unknown as Request).formData();
    } catch {
      return fail(400, 'The request body must be multipart form data.');
    }
    const file = form.get('file');
    const alt = form.get('alt');
    if (!(file instanceof File) || file.size === 0) return fail(400, 'A file is required.');
    if (file.size > MAX_UPLOAD_BYTES) return fail(413, 'The file is too large.');
    if (typeof alt !== 'string' || alt.trim() === '') {
      return fail(422, 'The alternative text (alt) is required.');
    }
    const doc = await req.payload.create({
      collection: media.slug,
      data: { alt: alt.trim() },
      file: {
        data: Buffer.from(await file.arrayBuffer()),
        mimetype: file.type,
        name: file.name,
        size: file.size,
      },
      req,
      overrideAccess: false,
    });
    const asset = normalizeMedia(doc);
    if (asset === null) return fail(500, 'The uploaded file has no URL.');
    return json(asset, 201);
  },
});
