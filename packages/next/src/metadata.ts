/** SEO fields of an entry (`meta` in the Payload plugin); every one is optional. */
export interface BuildrSeo {
  readonly title?: string | null;
  readonly description?: string | null;
  readonly image?: string | null;
  readonly noIndex?: boolean | null;
  readonly canonical?: string | null;
}

export interface BuildrMetadataEntry {
  /** The document's own title, the fallback for `meta.title`. */
  readonly title?: string | null;
  /** An excerpt, the fallback for `meta.description`. */
  readonly excerpt?: string | null;
  /** A featured image URL, the fallback for the Open Graph image. */
  readonly featuredImage?: string | null;
  readonly meta?: BuildrSeo | null;
  readonly locale?: string;
  /** hreflang: the path of this entry in every language. */
  readonly alternates?: Readonly<Record<string, string>>;
  /** Draft mode: the page is not indexed either. */
  readonly draft?: boolean;
}

export interface BuildrMetadataDefaults {
  readonly siteName?: string;
  /** With `alternates`: the language whose path also answers `x-default` in hreflang. */
  readonly defaultLocale?: string;
  readonly description?: string;
  readonly image?: string;
  /** `%s` is replaced by the page title: `"%s | Site"`. */
  readonly titleTemplate?: string;
}

/** The subset of Next's `Metadata` this produces, so the function needs no `next` import. */
export interface BuildrMetadata {
  title?: string;
  description?: string;
  robots?: { index: boolean; follow: boolean };
  alternates?: { canonical?: string; languages?: Record<string, string> };
  openGraph?: {
    title?: string;
    description?: string;
    siteName?: string;
    locale?: string;
    images?: string[];
  };
}

const present = (value: string | null | undefined): string | undefined =>
  value === null || value === undefined || value.trim() === '' ? undefined : value;

/**
 * Maps an entry's SEO fields onto Next's `Metadata` (docs/nextjs.md#generatemetadata-nextimage-nextlink).
 * Fallbacks: the document title, its excerpt, the featured image. `noIndex` and draft mode both
 * set `robots: noindex`.
 */
export function buildrMetadata(
  entry: BuildrMetadataEntry,
  defaults: BuildrMetadataDefaults = {},
): BuildrMetadata {
  const title = present(entry.meta?.title) ?? present(entry.title);
  const description =
    present(entry.meta?.description) ?? present(entry.excerpt) ?? present(defaults.description);
  const image =
    present(entry.meta?.image) ?? present(entry.featuredImage) ?? present(defaults.image);
  const canonical = present(entry.meta?.canonical);
  const fullTitle =
    title !== undefined && defaults.titleTemplate !== undefined
      ? defaults.titleTemplate.replace('%s', title)
      : title;

  const out: BuildrMetadata = {};
  if (fullTitle !== undefined) out.title = fullTitle;
  if (description !== undefined) out.description = description;
  if (entry.meta?.noIndex === true || entry.draft === true) {
    out.robots = { index: false, follow: false };
  }
  const languages = entry.alternates;
  if (canonical !== undefined || (languages !== undefined && Object.keys(languages).length > 0)) {
    out.alternates = {
      ...(canonical === undefined ? {} : { canonical }),
      ...(languages === undefined
        ? {}
        : { languages: withXDefault(languages, defaults.defaultLocale) }),
    };
  }
  out.openGraph = {
    ...(fullTitle === undefined ? {} : { title: fullTitle }),
    ...(description === undefined ? {} : { description }),
    ...(defaults.siteName === undefined ? {} : { siteName: defaults.siteName }),
    ...(entry.locale === undefined ? {} : { locale: entry.locale }),
    ...(image === undefined ? {} : { images: [image] }),
  };
  return out;
}

function withXDefault(
  languages: Readonly<Record<string, string>>,
  defaultLocale: string | undefined,
): Record<string, string> {
  const fallback = defaultLocale === undefined ? undefined : languages[defaultLocale];
  return { ...languages, ...(fallback === undefined ? {} : { 'x-default': fallback }) };
}
