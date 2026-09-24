import { describe, expect, it } from 'vitest';
import { alternatesOf, revalidateHooks, seoFromDocument, tagsFor } from './index.ts';

describe('tagsFor', () => {
  it('lists every dependency of a page once, sorted', () => {
    expect(
      tagsFor({
        collection: 'posts',
        id: 3,
        layoutRef: 'buildr-templates:9',
        collectionsUsed: ['posts', 'products'],
        globals: ['site-settings'],
      }),
    ).toEqual([
      'buildr:col:posts',
      'buildr:col:products',
      'buildr:doc:posts:3',
      'buildr:global:site-settings',
      'buildr:template:9',
      'buildr:theme',
    ]);
  });

  it('tags an own layout as the document and needs no id for a slug lookup', () => {
    expect(tagsFor({ collection: 'pages', layoutRef: 'pages:5' })).toEqual([
      'buildr:col:pages',
      'buildr:doc:pages:5',
      'buildr:theme',
    ]);
    expect(tagsFor({ collection: 'pages', layoutRef: null })).toEqual([
      'buildr:col:pages',
      'buildr:theme',
    ]);
  });
});

describe('revalidateHooks', () => {
  const run = () => {
    const tags: string[] = [];
    return { hooks: revalidateHooks((tag) => tags.push(tag)), tags };
  };
  const page = { collection: { slug: 'pages' } };

  it('revalidates a published page and its collection', () => {
    const { hooks, tags } = run();
    hooks.collection.afterChange[0]({ ...page, doc: { id: 1, _status: 'published' } });
    expect(tags).toEqual(['buildr:doc:pages:1', 'buildr:col:pages']);
  });

  it('revalidates an unpublish (it was published) but not a draft of a never-published page', () => {
    const { hooks, tags } = run();
    hooks.collection.afterChange[0]({
      ...page,
      doc: { id: 1, _status: 'draft' },
      previousDoc: { id: 1, _status: 'published' },
    });
    expect(tags).toHaveLength(2);
    tags.length = 0;
    hooks.collection.afterChange[0]({
      ...page,
      doc: { id: 2, _status: 'draft' },
      previousDoc: { id: 2, _status: 'draft' },
    });
    expect(tags).toEqual([]);
  });

  it('revalidates on delete, a global change and a template change (and the collection it targets)', () => {
    const { hooks, tags } = run();
    hooks.collection.afterDelete[0]({ ...page, doc: { id: 4 } });
    hooks.global.afterChange[0]({ global: { slug: 'site-settings' } });
    hooks.templates.afterChange[0]({
      collection: { slug: 'buildr-templates' },
      doc: { id: 8, targetCollection: 'pages', _status: 'published' },
      previousDoc: { id: 8, targetCollection: 'posts' },
    });
    expect(tags).toEqual([
      'buildr:doc:pages:4',
      'buildr:col:pages',
      'buildr:global:site-settings',
      'buildr:template:8',
      'buildr:col:pages',
      'buildr:col:posts',
    ]);
  });
});

describe('seoFromDocument', () => {
  it('maps plugin-seo fields and populated images', () => {
    expect(
      seoFromDocument(
        {
          title: 'Doc',
          excerpt: 'Short',
          featuredImage: { url: '/f.png' },
          meta: { title: 'SEO', description: 'Desc', image: { url: '/o.png' }, noIndex: true },
        },
        { locale: 'pl', draft: true },
      ),
    ).toEqual({
      title: 'Doc',
      excerpt: 'Short',
      featuredImage: '/f.png',
      meta: { title: 'SEO', description: 'Desc', image: '/o.png', noIndex: true, canonical: null },
      locale: 'pl',
      draft: true,
    });
  });

  it('ignores an image that is only an id and empty strings', () => {
    const out = seoFromDocument({ title: '', featuredImage: 12, meta: { image: 3 } });
    expect(out.title).toBeNull();
    expect(out.featuredImage).toBeNull();
    expect(out.meta?.image).toBeNull();
  });
});

describe('alternatesOf', () => {
  it('is empty without localization', async () => {
    const payload = { config: { localization: false } } as never;
    expect(await alternatesOf({ payload, collection: 'pages', id: 1, path: () => '/x' })).toEqual(
      {},
    );
  });

  it('collects the path in every language that has the document', async () => {
    const payload = {
      config: { localization: { localeCodes: ['pl', 'en', 'de'] } },
      findByID: async ({ locale }: { locale: string }) => {
        if (locale === 'de') throw new Error('missing');
        return { slug: `slug-${locale}` };
      },
    } as never;
    expect(
      await alternatesOf({
        payload,
        collection: 'pages',
        id: 1,
        path: (doc, locale) => `/${locale}/${String(doc['slug'])}`,
      }),
    ).toEqual({ pl: '/pl/slug-pl', en: '/en/slug-en' });
  });
});
