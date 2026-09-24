import type { PayloadRequest } from 'payload';
import { fail } from './respond.ts';

const originOf = (value: string | null | undefined): string | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
};

/**
 * The CSRF guard of a mutating request: the body must be declared JSON (a cross-site form cannot
 * send that without a preflight), and a browser-supplied `Origin` must be this server's own origin
 * or one of Payload's `csrf` allowlist. Requests without an `Origin` (scripts, server-to-server)
 * pass: browsers always send it on `PUT`/`POST`. Returns the response to send, or `undefined`.
 */
export function mutationGuard(req: PayloadRequest): Response | undefined {
  const contentType = req.headers.get('content-type') ?? '';
  if (!/^application\/json\s*(;|$)/i.test(contentType)) {
    return fail(415, 'The content type must be application/json.');
  }
  const origin = req.headers.get('origin');
  if (origin === null) return undefined;
  const requested = originOf(origin);
  const own = originOf(req.url);
  const allowlist = (req.payload.config.csrf ?? []).map(originOf);
  if (requested === undefined || (requested !== own && !allowlist.includes(requested))) {
    return fail(403, 'The origin of the request is not allowed.');
  }
  return undefined;
}
