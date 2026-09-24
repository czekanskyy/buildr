export interface LocaleSet {
  readonly locales: readonly string[];
  readonly default: string;
}

/** Whether `value` is one of the configured languages: the guard for a `[locale]` route segment (`notFound()` otherwise). */
export function isLocale(value: unknown, config: Pick<LocaleSet, 'locales'>): value is string {
  return typeof value === 'string' && config.locales.includes(value);
}

interface Preference {
  readonly tag: string;
  readonly q: number;
}

function parseAcceptLanguage(header: string): Preference[] {
  const preferences: Preference[] = [];
  for (const part of header.split(',')) {
    const [rawTag, ...params] = part.trim().split(';');
    const tag = rawTag?.trim().toLowerCase();
    if (tag === undefined || tag === '' || tag === '*') continue;
    let q = 1;
    for (const param of params) {
      const [key, value] = param.trim().split('=');
      if (key?.trim() === 'q') q = Number(value);
    }
    if (Number.isFinite(q) && q > 0) preferences.push({ tag, q });
  }
  // A stable sort keeps the header's order among equal weights.
  return preferences.sort((a, b) => b.q - a.q);
}

/**
 * The language a visitor asks for (`Accept-Language`): the best-weighted tag that matches a
 * configured locale exactly (`pl`) or by its primary subtag (`pl-PL` gives `pl`). The default
 * language when nothing matches or the header is missing.
 */
export function negotiateLocale(
  acceptLanguage: string | null | undefined,
  config: LocaleSet,
): string {
  if (acceptLanguage === null || acceptLanguage === undefined) return config.default;
  const byLowercase = new Map(config.locales.map((locale) => [locale.toLowerCase(), locale]));
  for (const { tag } of parseAcceptLanguage(acceptLanguage)) {
    const exact = byLowercase.get(tag);
    if (exact !== undefined) return exact;
    const primary = byLowercase.get(tag.split('-')[0] ?? '');
    if (primary !== undefined) return primary;
  }
  return config.default;
}

/**
 * Middleware for `middleware.ts` (docs/nextjs.md): redirects the bare `/` to `/{locale}` by
 * `Accept-Language` and does nothing else, so a cached page path never depends on a header or a
 * cookie. Returns `undefined` for every other request; the application continues with
 * `NextResponse.next()`.
 *
 * ```ts
 * const locale = createLocaleMiddleware({ locales: ['pl', 'en'], default: 'pl' });
 * export default (request: NextRequest) => locale(request) ?? NextResponse.next();
 * export const config = { matcher: '/' };
 * ```
 */
export function createLocaleMiddleware(
  config: LocaleSet,
): (request: Request) => Response | undefined {
  return (request) => {
    const url = new URL(request.url);
    if (url.pathname !== '/') return undefined;
    const locale = negotiateLocale(request.headers.get('accept-language'), config);
    return new Response(null, {
      status: 307,
      headers: {
        Location: new URL(`/${locale}${url.search}`, url).toString(),
        // The answer depends on the header, so no shared cache may reuse it for another visitor.
        Vary: 'Accept-Language',
      },
    });
  };
}

export interface LocaleStaticParamsInput {
  readonly locales: readonly string[];
  /** The published slugs of a language (`listPublishedSlugs`); a slug may contain `/`. */
  readonly slugs: (locale: string) => readonly string[] | Promise<readonly string[]>;
  /** The slug that is the site's home page: it is generated as the bare `/{locale}`. Default `home`. */
  readonly homeSlug?: string;
}

/**
 * `generateStaticParams` for `app/[locale]/[[...slug]]/page.tsx`: one entry per language and
 * published slug (`'a/b'` becomes `['a', 'b']`), the home page without a slug.
 */
export async function generateLocaleStaticParams(
  input: LocaleStaticParamsInput,
): Promise<{ locale: string; slug?: string[] }[]> {
  const home = input.homeSlug ?? 'home';
  const params: { locale: string; slug?: string[] }[] = [];
  for (const locale of input.locales) {
    for (const slug of await input.slugs(locale)) {
      params.push(slug === home ? { locale } : { locale, slug: slug.split('/').filter(Boolean) });
    }
  }
  return params;
}
