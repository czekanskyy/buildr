import { createHash } from 'node:crypto';
import { deriveFormSchema, MAX_FORM_FIELDS } from '@buildr/core';
import type { Endpoint, PayloadRequest } from 'payload';
import { resolveLayout, TEMPLATES_COLLECTION } from '../../data/resolve-layout.ts';
import { FORM_SUBMISSIONS_COLLECTION } from '../collections/form-submissions.ts';
import { isAllowedRecipient } from '../forms/notify.ts';
import { type SubmissionError, validateSubmission } from '../forms/validate.ts';
import { readLayout } from '../hooks/read-layout.ts';
import type { EndpointEnv } from './context.ts';
import { fail, json } from './respond.ts';

/** The component a form is: its node type in the document. */
export const FORM_TYPE = 'buildr/form';
/** The name of the honeypot input the form renders (`buildr/form`). */
export const HONEYPOT_FIELD = '_hp';
/** A submission is small; anything larger is refused before it is read. */
export const MAX_BODY_BYTES = 64 * 1024;

const MESSAGES: Record<SubmissionError['code'], string> = {
  unknown: 'This field is not part of the form.',
  required: 'This field is required.',
  invalid: 'This value is not valid.',
  'too-long': 'This value is too long.',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

type Body =
  | { readonly ok: true; readonly values: Record<string, unknown>; readonly json: boolean }
  | { readonly ok: false; readonly response: Response };

/** The submitted values of a JSON, urlencoded or multipart body; a file or a repeated name is kept as a value that fails validation. */
async function readBody(req: PayloadRequest): Promise<Body> {
  const type = (req.headers.get('content-type') ?? '').toLowerCase();
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return { ok: false, response: fail(413, 'The submission is too large.') };
  }
  try {
    if (type.startsWith('application/json')) {
      const body = await req.json?.();
      if (!isRecord(body)) return { ok: false, response: fail(400, 'The body must be an object.') };
      return { ok: true, values: body, json: true };
    }
    if (
      type.startsWith('application/x-www-form-urlencoded') ||
      type.startsWith('multipart/form-data')
    ) {
      const form = await req.formData?.();
      if (form === undefined) return { ok: false, response: fail(400, 'The body is not a form.') };
      const values: Record<string, unknown> = {};
      for (const name of new Set(form.keys())) {
        const all = form.getAll(name);
        values[name] = all.length === 1 && typeof all[0] === 'string' ? all[0] : all;
      }
      return { ok: true, values, json: false };
    }
  } catch {
    return { ok: false, response: fail(400, 'The body could not be read.') };
  }
  return { ok: false, response: fail(415, 'The content type must be a form or JSON.') };
}

/** The visitor's address, hashed with the server secret: enough to rate-limit, not to identify. */
function ipHashOf(req: PayloadRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || req.headers.get('x-real-ip') || 'unknown';
  return createHash('sha256').update(`${req.payload.secret}:${ip}`).digest('hex').slice(0, 32);
}

/** Back to the page the form was on (same origin only, so the redirect can never leave the site). */
function backTo(req: PayloadRequest, result: 'sent' | 'invalid'): Response {
  let location = '/';
  const referer = req.headers.get('referer');
  if (referer !== null) {
    try {
      const target = new URL(referer);
      if (target.origin === new URL(req.url ?? 'http://localhost').origin) {
        target.searchParams.set('buildr-form', result);
        location = `${target.pathname}${target.search}`;
      }
    } catch {
      // An unparseable referer goes to the home page.
    }
  }
  return new Response(null, { status: 303, headers: { location } });
}

const singleLine = (value: unknown): string => String(value).replace(/\s*[\r\n]+\s*/g, ' / ');

/**
 * `POST /api/buildr/forms/:collection/:id/:nodeId`: a public form submission (docs/security.md).
 * What the form accepts is never taken from the request: the schema is derived from the published
 * document (or, for an inherited layout, its template) by `deriveFormSchema`. Bots are turned away
 * by the honeypot and the rate limiter; a JSON caller gets JSON, a plain HTML form a `303` back.
 */
export const formsEndpoint = (env: EndpointEnv): Endpoint => ({
  path: '/buildr/forms/:collection/:id/:nodeId',
  method: 'post',
  handler: async (req) => {
    const collection = req.routeParams?.['collection'];
    const id = req.routeParams?.['id'];
    const nodeId = req.routeParams?.['nodeId'];
    if (typeof collection !== 'string' || typeof id !== 'string' || typeof nodeId !== 'string') {
      return fail(400, 'A collection, an id and a node are required.');
    }
    const own = env.options.collections[collection];
    const isTemplate = collection === TEMPLATES_COLLECTION;
    if ((own === undefined && !isTemplate) || req.payload.collections[collection] === undefined) {
      return fail(404, 'The form was not found.');
    }

    const ipHash = ipHashOf(req);
    const limited = await env.rateLimiter?.hit(`${ipHash}:${collection}:${id}:${nodeId}`);
    if (limited !== undefined && !limited.allowed) {
      const response = fail(429, 'Too many submissions. Try again later.');
      response.headers.set('retry-after', String(limited.retryAfterSeconds));
      return response;
    }

    const body = await readBody(req);
    if (!body.ok) return body.response;
    const wantsJson = body.json || (req.headers.get('accept') ?? '').includes('application/json');
    const done = (result: 'sent' | 'invalid') => (wantsJson ? undefined : backTo(req, result));

    // A person never sees the honeypot: a bot that filled it in is answered as if it had succeeded.
    const trap = body.values[HONEYPOT_FIELD];
    const { [HONEYPOT_FIELD]: _trap, ...values } = body.values;
    if (trap !== undefined && !(typeof trap === 'string' && trap === '')) {
      return done('sent') ?? json({ ok: true });
    }
    if (Object.keys(values).length > MAX_FORM_FIELDS) return fail(422, 'Too many fields.');

    // Only the published state is public: a draft, or a document never published, has no form.
    let stored: Record<string, unknown>;
    try {
      stored = (await req.payload.findByID({
        collection,
        id,
        draft: false,
        depth: 0,
        overrideAccess: true,
      })) as unknown as Record<string, unknown>;
    } catch {
      return fail(404, 'The form was not found.');
    }
    if (stored['_status'] !== 'published') return fail(404, 'The form was not found.');

    const layout = isTemplate
      ? stored['layout']
      : (
          await resolveLayout({
            payload: req.payload,
            collection,
            doc: stored,
            contextName: own?.context ?? collection,
            draft: false,
            overrideAccess: true,
          })
        ).layout;
    const read = readLayout(layout, env.options);
    const form =
      read.ok && Object.hasOwn(read.doc.nodes, nodeId) ? read.doc.nodes[nodeId] : undefined;
    if (
      !read.ok ||
      form === undefined ||
      form.type !== FORM_TYPE ||
      env.options.registry === undefined
    ) {
      return fail(404, 'The form was not found.');
    }

    const { schema } = deriveFormSchema(read.doc, env.options.registry.meta, nodeId);
    const result = validateSubmission(schema, values);
    if (!result.ok) {
      if (!wantsJson) return backTo(req, 'invalid');
      const errors: Record<string, string> = {};
      const codes: Record<string, string> = {};
      for (const error of result.errors) {
        errors[error.field] = MESSAGES[error.code];
        codes[error.field] = error.code;
      }
      return json({ errors, codes }, 422);
    }

    await req.payload.create({
      collection: FORM_SUBMISSIONS_COLLECTION,
      data: {
        form: { collection, documentId: id, nodeId },
        data: result.data,
        locale: typeof req.locale === 'string' ? req.locale : null,
        meta: { userAgent: (req.headers.get('user-agent') ?? '').slice(0, 300), ipHash },
      },
      overrideAccess: true,
    });

    const recipients = env.options.forms.notifyTo.filter((address) =>
      isAllowedRecipient(address, env.options.forms.notifyAllowlist),
    );
    if (recipients.length > 0) {
      try {
        await req.payload.sendEmail({
          to: recipients.join(', '),
          subject: `New form submission (${collection}/${id})`,
          text: Object.entries(result.data)
            .map(([name, value]) => `${name}: ${singleLine(value)}`)
            .join('\n'),
        });
      } catch (error) {
        // The submission is stored; a mail server that is down does not lose it or fail the visitor.
        req.payload.logger.error({ err: error, msg: 'buildr: the form notification was not sent' });
      }
    }
    return done('sent') ?? json({ ok: true });
  },
});
