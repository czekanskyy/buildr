import { draftMode } from 'next/headers';
import { safeRedirectPath } from './route.ts';

export interface ExitPreviewRouteOptions {
  /** Where to go when the request names no (valid) `path`. Default `/`. */
  readonly defaultPath?: string;
}

/**
 * The GET handler of `/buildr/preview/exit`: turns draft mode off and redirects to `?path=` (a
 * relative path only). It needs no authorization, since leaving preview grants nothing.
 */
export function createExitPreviewRoute(options: ExitPreviewRouteOptions = {}) {
  return async function GET(request: Request): Promise<Response> {
    const path = safeRedirectPath(
      new URL(request.url).searchParams.get('path'),
      safeRedirectPath(options.defaultPath),
    );
    (await draftMode()).disable();
    return new Response(null, { status: 307, headers: { Location: path } });
  };
}
