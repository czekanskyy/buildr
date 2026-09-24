import { describe, expect, it } from 'vitest';
import { buildrMetadata } from './metadata.ts';

describe('buildrMetadata', () => {
  it('prefers the SEO fields and falls back to the document', () => {
    expect(
      buildrMetadata(
        { title: 'Doc', excerpt: 'Excerpt', featuredImage: '/f.png', meta: { title: 'SEO' } },
        { titleTemplate: '%s | Site', siteName: 'Site' },
      ),
    ).toEqual({
      title: 'SEO | Site',
      description: 'Excerpt',
      openGraph: {
        title: 'SEO | Site',
        description: 'Excerpt',
        siteName: 'Site',
        images: ['/f.png'],
      },
    });
    expect(buildrMetadata({ title: 'Doc', meta: { title: '  ' } }).title).toBe('Doc');
  });

  it('marks noIndex and drafts as not indexable', () => {
    expect(buildrMetadata({ meta: { noIndex: true } }).robots).toEqual({
      index: false,
      follow: false,
    });
    expect(buildrMetadata({ draft: true }).robots).toEqual({ index: false, follow: false });
    expect(buildrMetadata({}).robots).toBeUndefined();
  });

  it('emits canonical and hreflang alternates', () => {
    expect(
      buildrMetadata({
        meta: { canonical: 'https://x.test/a' },
        alternates: { pl: '/pl/a', en: '/en/a' },
        locale: 'pl',
      }),
    ).toMatchObject({
      alternates: { canonical: 'https://x.test/a', languages: { pl: '/pl/a', en: '/en/a' } },
      openGraph: { locale: 'pl' },
    });
  });
});
