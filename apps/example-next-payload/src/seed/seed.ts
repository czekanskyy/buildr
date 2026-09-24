import { BUILDR_WRITE } from '@buildr/payload/plugin';
import type { Payload } from 'payload';
import {
  AUTHORS,
  type Bilingual,
  CATEGORIES,
  MEDIA,
  POSTS,
  PRODUCT_CATEGORIES,
  PRODUCTS,
  SITE,
  type TaxonomySpec,
} from './content.ts';
import { buildSeedDocuments, type SeedMedia } from './documents.ts';
import { placeholderSvg } from './svg.ts';

type Locale = 'pl' | 'en';
const LOCALES: readonly Locale[] = ['pl', 'en'];

export interface SeedSummary {
  readonly created: Readonly<Record<string, number>>;
  readonly skipped: Readonly<Record<string, number>>;
}

/** A minimal Lexical tree of plain paragraphs. */
function lexical(paragraphs: readonly string[]): Record<string, unknown> {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr',
      children: paragraphs.map((text) => ({
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        children: [
          { type: 'text', text, format: 0, mode: 'normal', style: '', detail: 0, version: 1 },
        ],
      })),
    },
  };
}

/**
 * Fills the database with the demo content. Idempotent: every document is looked up by its natural
 * key (slug, SKU, e-mail…) and left alone when it exists, so running it twice changes nothing.
 */
export async function seed(
  payload: Payload,
  log: (message: string) => void = () => {},
): Promise<SeedSummary> {
  const created: Record<string, number> = {};
  const skipped: Record<string, number> = {};
  const count = (bag: Record<string, number>, key: string): void => {
    bag[key] = (bag[key] ?? 0) + 1;
  };

  const find = async (
    collection: string,
    field: string,
    value: string,
  ): Promise<{ id: number | string } | undefined> => {
    const found = await payload.find({
      collection: collection as 'pages',
      where: { [field]: { equals: value } },
      limit: 1,
      depth: 0,
      locale: 'pl',
      draft: true,
      overrideAccess: true,
    });
    const doc = found.docs[0] as { id: number | string } | undefined;
    return doc;
  };

  /** Creates the Polish version, then adds the English fields to the same document. */
  const upsert = async (
    collection: string,
    key: { field: string; value: string },
    build: (locale: Locale) => Record<string, unknown>,
    options: { published?: boolean; write?: boolean } = {},
  ): Promise<{ id: number | string; isNew: boolean }> => {
    const existing = await find(collection, key.field, key.value);
    if (existing !== undefined) {
      count(skipped, collection);
      return { id: existing.id, isNew: false };
    }
    const context = options.write === true ? { [BUILDR_WRITE]: true } : {};
    const status = options.published === true ? { _status: 'published' } : {};
    const doc = (await payload.create({
      collection: collection as 'pages',
      data: { ...build('pl'), ...status } as never,
      locale: 'pl',
      context,
      overrideAccess: true,
    })) as { id: number | string };
    await payload.update({
      collection: collection as 'pages',
      id: doc.id,
      data: { ...build('en'), ...status } as never,
      locale: 'en',
      context: { [BUILDR_WRITE]: true },
      overrideAccess: true,
    });
    count(created, collection);
    log(`${collection}: ${key.value}`);
    return { id: doc.id, isNew: true };
  };

  // Media: one SVG per picture, deduplicated by filename.
  const media: Record<string, SeedMedia> = {};
  const rawIds: Record<string, number | string> = {};
  for (const spec of MEDIA) {
    const filename = `${spec.key}.svg`;
    const found = await find('media', 'filename', filename);
    let id: number | string;
    if (found === undefined) {
      const data = Buffer.from(placeholderSvg(spec.hue, spec.alt.en));
      const doc = (await payload.create({
        collection: 'media',
        data: { alt: spec.alt.pl },
        file: { data, mimetype: 'image/svg+xml', name: filename, size: data.length },
        locale: 'pl',
        overrideAccess: true,
      })) as { id: number | string };
      await payload.update({
        collection: 'media',
        id: doc.id,
        data: { alt: spec.alt.en },
        locale: 'en',
        overrideAccess: true,
      });
      id = doc.id;
      count(created, 'media');
    } else {
      id = found.id;
      count(skipped, 'media');
    }
    rawIds[spec.key] = id;
    media[spec.key] = {
      id: String(id),
      url: `/api/media/file/${filename}`,
      alt: spec.alt,
      width: 1200,
      height: 800,
    };
  }
  const mediaId = (key: string): number | string => {
    const id = rawIds[key];
    if (id === undefined) throw new Error(`Unknown seed media "${key}"`);
    return id;
  };

  // Site settings.
  await payload.updateGlobal({
    slug: 'site-settings',
    data: { siteName: SITE.siteName.pl, social: SITE.socials.map((social) => ({ ...social })) },
    locale: 'pl',
    overrideAccess: true,
  });
  await payload.updateGlobal({
    slug: 'site-settings',
    data: { siteName: SITE.siteName.en },
    locale: 'en',
    overrideAccess: true,
  });

  // Taxonomies.
  const taxonomy = async (
    collection: 'categories' | 'product-categories',
    specs: readonly TaxonomySpec[],
  ): Promise<(number | string)[]> => {
    const ids: (number | string)[] = [];
    for (const spec of specs) {
      const { id } = await upsert(collection, { field: 'slug', value: spec.slug.pl }, (locale) => ({
        title: spec.title[locale],
        slug: spec.slug[locale],
        description: spec.description[locale],
      }));
      ids.push(id);
    }
    return ids;
  };
  const categoryIds = await taxonomy('categories', CATEGORIES);
  const productCategoryIds = await taxonomy('product-categories', PRODUCT_CATEGORIES);

  // Authors.
  const authorIds: Record<string, number | string> = {};
  for (const author of AUTHORS) {
    const { id } = await upsert('authors', { field: 'slug', value: author.slug }, (locale) => ({
      name: author.name,
      slug: author.slug,
      avatar: mediaId(author.avatar),
      jobTitle: author.jobTitle[locale],
      bio: author.bio[locale],
    }));
    authorIds[author.slug] = id;
  }

  // Posts.
  const now = Date.now();
  for (const spec of POSTS) {
    await upsert(
      'posts',
      { field: 'slug', value: spec.slug.pl },
      (locale) => ({
        title: spec.title[locale],
        slug: spec.slug[locale],
        excerpt: spec.excerpt[locale],
        content: lexical(spec.body[locale]),
        featuredImage: mediaId(spec.image),
        author: authorIds[spec.author],
        categories: [categoryIds[spec.category]],
        publishedAt: new Date(now - spec.daysAgo * 86_400_000).toISOString(),
      }),
      { published: true },
    );
  }

  // Products.
  for (const spec of PRODUCTS) {
    await upsert(
      'products',
      { field: 'slug', value: spec.slug.pl },
      (locale) => ({
        title: spec.title[locale],
        slug: spec.slug[locale],
        sku: spec.sku,
        price: spec.price,
        ...(spec.compareAtPrice === undefined ? {} : { compareAtPrice: spec.compareAtPrice }),
        currency: 'PLN',
        availability: spec.availability,
        shortDescription: spec.shortDescription[locale],
        description: lexical(spec.description[locale]),
        images: spec.images.map(mediaId),
        categories: [productCategoryIds[spec.category]],
        attributes: spec.attributes.map((attribute) => ({
          name: attribute.name[locale],
          value: attribute.value[locale],
        })),
      }),
      { published: true },
    );
  }

  // Pages and layout templates.
  const docs = buildSeedDocuments({ team: media['team'] as SeedMedia });
  const pageTitles: Record<string, Bilingual> = {
    home: { pl: 'Strona główna', en: 'Home' },
    about: { pl: 'O nas', en: 'About' },
    blog: { pl: 'Blog', en: 'Blog' },
    contact: { pl: 'Kontakt', en: 'Contact' },
  };
  for (const [slug, layout] of Object.entries(docs.pages)) {
    const title = pageTitles[slug] as Bilingual;
    await upsert(
      'pages',
      { field: 'slug', value: slug },
      (locale) => ({ title: title[locale], slug, ...(locale === 'pl' ? { layout } : {}) }),
      { published: true },
    );
  }
  const templates = [
    { target: 'posts', title: 'Wpis na blogu', layout: docs.templates.post },
    { target: 'products', title: 'Karta produktu', layout: docs.templates.product },
  ] as const;
  for (const template of templates) {
    await upsert(
      'buildr-templates',
      { field: 'targetCollection', value: template.target },
      (locale) =>
        locale === 'pl'
          ? {
              title: template.title,
              targetCollection: template.target,
              isDefault: true,
              layout: template.layout,
            }
          : {},
    );
  }

  return { created, skipped };
}

export { LOCALES };
