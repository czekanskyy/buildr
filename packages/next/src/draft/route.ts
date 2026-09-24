import { draftMode } from 'next/headers';

/**
 * A redirect target that stays on this site: a path starting with a single `/`. Anything that a
 * browser could read as another origin (`//host`, `/\host`, a scheme, control characters) is
 * refused, so the preview route cannot be used as an open redirect.
 */
export function safeRedirectPath(value: string | null | undefined, fallback = '/'): string {
  if (value === null || value === undefined || value === '') return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  // Backslashes are treated as slashes by browsers; control characters can smuggle a newline or a scheme.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting them is the point
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  return value;
}

const redirect = (path: string): Response =>
  new Response(null, { status: 307, headers: { Location: path } });

export interface PreviewRouteOptions {
  /**
   * Decides whether the request may see drafts (a session check, a shared secret, ...). Without a
   * yes the answer is `401` and draft mode stays off.
   */
  readonly authorize: (request: Request) => boolean | Promise<boolean>;
  /** Where to go when the request names no (valid) `path`. Default `/`. */
  readonly defaultPath?: string;
}

/**
 * The GET handler of `/buildr/preview` (docs/nextjs.md): checks the caller, turns draft mode on and
 * redirects to `?path=/relative/path`. Export it as `GET` from the route file.
 */
export function createPreviewRoute(options: PreviewRouteOptions) {
  return async function GET(request: Request): Promise<Response> {
    if (!(await options.authorize(request))) {
      return new Response('Unauthorized', { status: 401 });
    }
    const path = safeRedirectPath(
      new URL(request.url).searchParams.get('path'),
      safeRedirectPath(options.defaultPath),
    );
    (await draftMode()).enable();
    return redirect(path);
  };
}
