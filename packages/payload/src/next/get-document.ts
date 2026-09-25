import type { DataContext, JsonValue } from '@buildr/core';
import type { Payload, Where } from 'payload';
import type { SchemaOptions, SchemaSource } from '../data/index.ts';
import { buildContext, resolveLayout } from '../data/index.ts';
import { configuredLocales, localeConfigOf } from '../plugin/locales.ts';
import { collectionTag, docTag, globalTag } from './tags.ts';

const SITE_GLOBAL = 'site-settings';

/** Wraps a read in a tagged cache. The default is `unstable_cache` (Next 15 and 16). */
export type CacheRead = <T>(
  read: () => Promise<T>,
  keyParts: string[],
  options: { readonly tags: string[] },
) => () => Promise<T>;

const defaultCache: CacheRead = (read, keyParts, options) => {
  let cached: (() => Promise<unknown>) | undefined;
  return async () => {
    // Loaded on first use so this module can be imported (and tested) outside Next.js.
    const { unstable_cache } = await import('next/cache');
    cached ??= unstable_cache(read, keyParts, { tags: options.tags });
    return (await cached()) as never;
  };
};

export interface GetBuildrDocumentInput {
  readonly payload: Payload;
  readonly collection: string;
  /** Look the document up by its slug field... */
  readonly slug?: string;
  /** ...or by id. */
  readonly id?: string | number;
  readonly slugField?: string;
  readonly locale?: string;
  /**
   * Read the latest draft with the permissions of `user` (uncached). Without a user the read is a
   * visitor's, so it sees only what is published.
   */
  readonly draft?: boolean;
  readonly user?: unknown;
  /** The name the document is bound under (`page`, `post`); the collection slug by default. */
  readonly contextName?: string;
  /** The public path of the document, for the `route` scope. */
  readonly path?: (doc: Record<string, unknown>) => string;
  /** Relation depth of the read. Default `1`. */
  readonly depth?: number;
  /** The page of a paginated listing: `route.params.page`. */
  readonly page?: number;
  readonly timeZone?: string;
  /** Replaces the tagged cache (tests, hosts with their own). */
  readonly cache?: CacheRead;
}

/** What `BuildrPage` (`@buildr/next`) renders, plus the document itself and its cache tags. */
export interface BuildrDocumentEntry {
  /** The resolved layout, as stored: `BuildrPage` migrates and validates it. */
  readonly document: unknown;
  readonly context: DataContext;
  readonly layoutRef: string | null;
  readonly layoutSource: 'document' | 'template' | 'default-template' | 'builtin';
  readonly currentId: string | number;
  /** The Payload document (populated to `depth`), for metadata. */
  readonly doc: Record<string, unknown>;
  /** The tags this entry was cached under. */
  readonly tags: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The production read of a page (docs/nextjs.md): the document (by slug or id), its layout
 * (`resolveLayout`), and the `DataContext` (`buildContext`) in one call, or `null` when there is no
 * such document (a `404`). Published reads go through a tagged cache that `revalidateHooks()`
 * invalidates; a draft read is never cached.
 */
export async function getBuildrDocument(
  input: GetBuildrDocumentInput,
): Promise<BuildrDocumentEntry | null> {
  const { payload, collection } = input;
  if ((input.slug === undefined) === (input.id === undefined)) {
    throw new Error('getBuildrDocument needs exactly one of `slug` and `id`.');
  }
  const configured = configuredLocales(payload.config);
  const locale = input.locale ?? configured?.default;
  if (configured !== undefined && locale !== undefined && !configured.locales.includes(locale)) {
    return null;
  }
  const localeArgs =
    configured === undefined || locale === undefined
      ? {}
      : { locale, ...(configured.fallback ? {} : { fallbackLocale: false as const }) };

  const draft = input.draft === true && input.user !== undefined && input.user !== null;
  const hasSite = payload.config.globals?.some((global) => global.slug === SITE_GLOBAL) === true;
  const access = draft
    ? { user: input.user as never, overrideAccess: false }
    : { overrideAccess: false };

  const read = async (): Promise<Omit<BuildrDocumentEntry, 'tags'> | null> => {
    let doc: Record<string, unknown> | undefined;
    const depth = input.depth ?? 1;
    if (input.id !== undefined) {
      doc = await payload
        .findByID({
          collection: collection as never,
          id: input.id,
          depth,
          draft,
          ...localeArgs,
          ...access,
        })
        .then((found) => found as unknown as Record<string, unknown>)
        .catch(() => undefined);
      // A visitor sees published documents only, whatever the collection's read access says.
      if (
        !draft &&
        doc !== undefined &&
        doc['_status'] !== undefined &&
        doc['_status'] !== 'published'
      ) {
        doc = undefined;
      }
    } else {
      const where: Where = {
        and: [
          { [input.slugField ?? 'slug']: { equals: input.slug } },
          ...(draft ? [] : [{ _status: { equals: 'published' } } as Where]),
        ],
      };
      const found = await payload.find({
        collection: collection as never,
        where,
        limit: 1,
        pagination: false,
        depth,
        draft,
        ...localeArgs,
        ...access,
      });
      doc = found.docs[0] as unknown as Record<string, unknown> | undefined;
    }
    if (doc === undefined || (typeof doc['id'] !== 'string' && typeof doc['id'] !== 'number')) {
      return null;
    }
    const id = doc['id'];
    const contextName = input.contextName ?? collection;

    const resolved = await resolveLayout({
      payload,
      collection,
      doc,
      contextName,
      draft,
      ...(draft ? { overrideAccess: false } : {}),
    });

    let site: Record<string, unknown> | undefined;
    if (hasSite) {
      try {
        site = (await payload.findGlobal({
          slug: SITE_GLOBAL as never,
          depth: 1,
          draft,
          ...localeArgs,
          ...access,
        })) as unknown as Record<string, unknown>;
      } catch {
        site = undefined;
      }
    }

    const source: SchemaSource = {
      collections: payload.config.collections as unknown as SchemaSource['collections'],
      globals: (payload.config.globals ?? []) as unknown as NonNullable<SchemaSource['globals']>,
    };
    const options: SchemaOptions = {
      contextNames: { [collection]: contextName },
      siteGlobal: SITE_GLOBAL,
    };
    const localeConfig = localeConfigOf(payload.config);
    const path = input.path?.(doc) ?? '';
    const scopes = buildContext({
      source,
      options,
      collection,
      doc,
      site,
      route: {
        path,
        locale: locale ?? localeConfig.default,
        ...(input.page === undefined ? {} : { page: input.page }),
      },
    });
    const context: DataContext = {
      scopes: scopes as Record<string, JsonValue>,
      locale: locale ?? localeConfig.default,
      locales: {
        default: localeConfig.default,
        fallback: localeConfig.fallback,
        intl: localeConfig.intl,
      },
      timeZone: input.timeZone ?? 'UTC',
      mode: draft ? 'preview' : 'production',
    };
    return {
      document: resolved.layout,
      context,
      layoutRef: resolved.layoutRef,
      layoutSource: resolved.source,
      currentId: id,
      doc,
    };
  };

  const tags = [
    collectionTag(collection),
    ...(input.id === undefined ? [] : [docTag(collection, input.id)]),
    ...(hasSite ? [globalTag(SITE_GLOBAL)] : []),
    'buildr:theme',
  ].sort();

  const entry = draft
    ? await read()
    : await (input.cache ?? defaultCache)(
        read,
        [
          'buildr:document',
          collection,
          input.slug !== undefined ? `slug:${input.slug}` : `id:${String(input.id)}`,
          locale ?? '',
          String(input.depth ?? 1),
          input.page === undefined ? '' : `page:${input.page}`,
        ],
        { tags },
      )();
  if (entry === null) return null;
  // The tags of the document that was found, which a slug lookup could not know beforehand.
  const found = new Set(tags);
  found.add(docTag(collection, entry.currentId));
  if (entry.layoutRef !== null) {
    const at = entry.layoutRef.indexOf(':');
    const owner = entry.layoutRef.slice(0, at);
    const ref = entry.layoutRef.slice(at + 1);
    found.add(owner === 'buildr-templates' ? `buildr:template:${ref}` : docTag(owner, ref));
  }
  return { ...entry, tags: [...found].sort() };
}

export interface ListPublishedSlugsInput {
  readonly payload: Payload;
  readonly collection: string;
  readonly slugField?: string;
  readonly locale?: string;
  /** Upper bound; a site with more pages relies on `dynamicParams` for the rest. Default `1000`. */
  readonly limit?: number;
}

/** The slugs of the published documents, for `generateStaticParams`. Documents without a slug are skipped. */
export async function listPublishedSlugs(input: ListPublishedSlugsInput): Promise<string[]> {
  const field = input.slugField ?? 'slug';
  const configured = configuredLocales(input.payload.config);
  const localeArgs =
    configured === undefined
      ? {}
      : {
          locale: input.locale ?? configured.default,
          ...(configured.fallback ? {} : { fallbackLocale: false as const }),
        };
  const result = await input.payload.find({
    collection: input.collection as never,
    where: { _status: { equals: 'published' } },
    limit: input.limit ?? 1000,
    pagination: false,
    depth: 0,
    draft: false,
    overrideAccess: false,
    select: { [field]: true } as never,
    ...localeArgs,
  });
  const slugs: string[] = [];
  for (const doc of result.docs as unknown as Record<string, unknown>[]) {
    const slug = doc[field];
    if (typeof slug === 'string' && slug !== '' && isRecord(doc)) slugs.push(slug);
  }
  return slugs;
}
