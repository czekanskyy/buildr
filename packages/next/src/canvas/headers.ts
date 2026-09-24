export interface SecurityHeadersOptions {
  /** Path of the canvas route. Default `/buildr/canvas`. */
  readonly canvasPath?: string;
  /** Path prefix of the editor routes. Default `/buildr/edit`. */
  readonly editPath?: string;
}

export interface HeaderRule {
  source: string;
  // Mutable on purpose: this must be assignable to Next's own `Header` in `headers()` of next.config.
  headers: { key: string; value: string }[];
}

const header = (key: string, value: string) => ({ key, value });

/**
 * The `headers()` rules for `next.config` (docs/nextjs.md#preview--draft-mode-caching-revalidation-errors):
 * the canvas may be framed by this site only and is never cached or indexed; the editor may not be
 * framed at all; public pages may be framed by this site, so the editor's own preview can embed them.
 *
 * ```ts
 * const nextConfig = { headers: async () => buildrSecurityHeaders() };
 * ```
 */
export function buildrSecurityHeaders(options: SecurityHeadersOptions = {}): HeaderRule[] {
  const canvas = options.canvasPath ?? '/buildr/canvas';
  const edit = options.editPath ?? '/buildr/edit';
  const lookaheadPart = (path: string) =>
    path.replace(/^\//, '').replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
  return [
    {
      source: canvas,
      headers: [
        header('Content-Security-Policy', "frame-ancestors 'self'"),
        header('Cache-Control', 'private, no-store'),
        header('X-Robots-Tag', 'noindex'),
      ],
    },
    {
      source: `${edit}/:path*`,
      headers: [
        header('Content-Security-Policy', "frame-ancestors 'none'"),
        header('Cache-Control', 'private, no-store'),
        header('X-Robots-Tag', 'noindex'),
      ],
    },
    {
      source: `/((?!${lookaheadPart(canvas)}|${lookaheadPart(edit)}).*)`,
      headers: [header('Content-Security-Policy', "frame-ancestors 'self'")],
    },
  ];
}
