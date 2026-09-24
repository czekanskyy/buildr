import { buildrMetadata } from '@buildr/next';
import {
  alternatesOf,
  getBuildrDocument,
  listPublishedSlugs,
  seoFromDocument,
} from '@buildr/payload/next';
import type { Metadata } from 'next';
import { draftMode, headers } from 'next/headers';
import { cache } from 'react';
import { DEFAULT_LOCALE, LOCALES } from '../buildr.registry.ts';
import { getPayloadClient } from '../buildr.server.ts';

export type CollectionName = 'pages' | 'posts' | 'products';

/** The public URL of a document: the same rule the plugin uses for "view on site". */
const PATHS: Record<CollectionName, (slug: string) => string> = {
  pages: (slug) => (slug === 'home' ? '' : `/${slug}`),
  posts: (slug) => `/blog/${slug}`,
  products: (slug) => `/products/${slug}`,
};
const CONTEXT: Record<CollectionName, string> = {
  pages: 'page',
  posts: 'post',
  products: 'product',
};

export const pathOf = (collection: CollectionName, slug: string, locale: string): string =>
  `/${locale}${PATHS[collection](slug)}`;

/** The signed-in user, only when draft mode is on (preview); visitors always get `undefined`. */
async function previewUser(): Promise<unknown> {
  if (!(await draftMode()).isEnabled) return undefined;
  const payload = await getPayloadClient();
  return (await payload.auth({ headers: await headers() })).user ?? undefined;
}

export interface LoadInput {
  readonly collection: CollectionName;
  readonly slug: string;
  readonly locale: string;
  /** The page of a paginated listing, for `route.params.page`. */
  readonly page?: number;
}

/** One read per request, shared by `generateMetadata` and the page (React `cache`). */
export const loadEntry = cache(
  async (collection: CollectionName, slug: string, locale: string, page: number) => {
    const payload = await getPayloadClient();
    const user = await previewUser();
    const draft = user !== undefined;
    const entry = await getBuildrDocument({
      payload,
      collection,
      slug,
      locale,
      draft,
      user,
      contextName: CONTEXT[collection],
      path: (doc) => pathOf(collection, String(doc['slug'] ?? slug), locale),
      depth: 1,
    });
    return entry === null ? null : { entry, draft, page };
  },
);

export async function load(input: LoadInput) {
  return loadEntry(input.collection, input.slug, input.locale, input.page ?? 1);
}

const siteDefaults = cache(async (locale: string) => {
  const payload = await getPayloadClient();
  const site = await payload
    .findGlobal({ slug: 'site-settings', locale, depth: 1 })
    .catch(() => null);
  const siteName = typeof site?.['siteName'] === 'string' ? site['siteName'] : 'Buildr';
  return { siteName, titleTemplate: `%s | ${siteName}`, defaultLocale: DEFAULT_LOCALE };
});

/** `generateMetadata` for any of the three collections: SEO fields, hreflang, noindex for drafts. */
export async function metadataFor(input: LoadInput): Promise<Metadata> {
  const loaded = await load(input);
  if (loaded === null) return {};
  const payload = await getPayloadClient();
  const { entry } = loaded;
  const alternates = await alternatesOf({
    payload,
    collection: input.collection,
    id: entry.currentId,
    path: (doc, locale) => pathOf(input.collection, String(doc['slug'] ?? input.slug), locale),
  });
  const seo = seoFromDocument(entry.doc, {
    locale: input.locale,
    alternates,
    draft: loaded.draft,
  });
  return buildrMetadata(seo, await siteDefaults(input.locale)) as Metadata;
}

export const isSupported = (locale: string): boolean =>
  (LOCALES as readonly string[]).includes(locale);

/**
 * Published slugs for `generateStaticParams`. A build without a reachable database (CI, a fresh
 * checkout) prerenders nothing instead of failing; `dynamicParams` renders the pages on first visit.
 */
export async function publishedSlugs(
  collection: CollectionName,
  locale: string,
): Promise<string[]> {
  try {
    return await listPublishedSlugs({ payload: await getPayloadClient(), collection, locale });
  } catch (error) {
    console.warn(
      `[buildr] no static params for ${collection}/${locale}:`,
      (error as Error).message,
    );
    return [];
  }
}
