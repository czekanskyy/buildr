/**
 * Puts the language in front of a preview path that lacks it: `/about` with `pl` gives
 * `/pl/about`, while `/pl/about` and `/pl` stay. A language that is not configured changes nothing.
 */
export function withLocalePrefix(
  path: string,
  locale: string | null,
  locales: readonly string[] | undefined,
): string {
  if (locale === null || locales === undefined || !locales.includes(locale)) return path;
  const first = path.split(/[/?#]/)[1];
  if (first !== undefined && locales.includes(first)) return path;
  return path === '/' ? `/${locale}` : `/${locale}${path}`;
}
