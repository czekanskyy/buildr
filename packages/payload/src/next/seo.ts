import type { Payload } from 'payload';

/** What `buildrMetadata` (`@next-buildr/next`) takes; declared here so this package needs no runtime import of it. */
export interface SeoEntry {
  readonly title?: string | null;
  readonly excerpt?: string | null;
  readonly featuredImage?: string | null;
  readonly meta?: {
    readonly title?: string | null;
    readonly description?: string | null;
    readonly image?: string | null;
    readonly noIndex?: boolean | null;
    readonly canonical?: string | null;
  } | null;
  readonly locale?: string;
  readonly alternates?: Readonly<Record<string, string>>;
  readonly draft?: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null;

/** The URL of an upload field: a populated media document, or nothing when it is only an id. */
const urlOf = (value: unknown): string | null => (isRecord(value) ? text(value['url']) : null);

export interface SeoOptions {
  readonly locale?: string;
  readonly draft?: boolean;
  /** The field holding a short summary. Default `excerpt`. */
  readonly excerptField?: string;
  /** The field holding the featured image (a populated upload). Default `featuredImage`. */
  readonly imageField?: string;
  readonly alternates?: Readonly<Record<string, string>>;
}

/**
 * Maps a Payload document onto the shape `buildrMetadata` takes. Reads the fields of
 * `@payloadcms/plugin-seo` (`meta.title`, `meta.description`, `meta.image`) plus `meta.noIndex` and
 * `meta.canonical` when the application defines them. Images must be populated (`depth >= 1`).
 */
export function seoFromDocument(
  doc: Readonly<Record<string, unknown>>,
  options: SeoOptions = {},
): SeoEntry {
  const meta = isRecord(doc['meta']) ? doc['meta'] : {};
  return {
    title: text(doc['title']),
    excerpt: text(doc[options.excerptField ?? 'excerpt']),
    featuredImage: urlOf(doc[options.imageField ?? 'featuredImage']),
    meta: {
      title: text(meta['title']),
      description: text(meta['description']),
      image: urlOf(meta['image']),
      noIndex: meta['noIndex'] === true,
      canonical: text(meta['canonical']),
    },
    ...(options.locale === undefined ? {} : { locale: options.locale }),
    ...(options.alternates === undefined ? {} : { alternates: options.alternates }),
    ...(options.draft === true ? { draft: true } : {}),
  };
}

/**
 * The path of a document in every configured language (hreflang): one read per locale, so a
 * localized slug gives each language its own URL. A language without the document is left out.
 */
export async function alternatesOf(input: {
  readonly payload: Payload;
  readonly collection: string;
  readonly id: string | number;
  readonly path: (doc: Record<string, unknown>, locale: string) => string;
}): Promise<Record<string, string>> {
  const localization = input.payload.config.localization;
  if (localization === false || localization === undefined) return {};
  const result: Record<string, string> = {};
  for (const locale of localization.localeCodes) {
    try {
      const doc = await input.payload.findByID({
        collection: input.collection as never,
        id: input.id,
        locale,
        fallbackLocale: false,
        depth: 0,
      });
      result[locale] = input.path(doc as unknown as Record<string, unknown>, locale);
    } catch {
      // not published (or not readable) in this language
    }
  }
  return result;
}
