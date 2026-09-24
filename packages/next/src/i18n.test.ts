import { describe, expect, it } from 'vitest';
import { withLocalePrefix } from './draft/locale-path.ts';
import {
  createLocaleMiddleware,
  generateLocaleStaticParams,
  isLocale,
  negotiateLocale,
} from './i18n.ts';
import { buildrMetadata } from './metadata.ts';

const config = { locales: ['pl', 'en', 'pt-BR'], default: 'pl' };

describe('negotiateLocale', () => {
  it('picks the best-weighted match, by exact tag or primary subtag', () => {
    expect(negotiateLocale('en-US,en;q=0.9,pl;q=0.8', config)).toBe('en');
    expect(negotiateLocale('de,pl;q=0.5,en;q=0.9', config)).toBe('en');
    expect(negotiateLocale('pt-br', config)).toBe('pt-BR');
    expect(negotiateLocale('pt', config)).toBe('pl');
  });

  it('falls back to the default language', () => {
    expect(negotiateLocale(null, config)).toBe('pl');
    expect(negotiateLocale('', config)).toBe('pl');
    expect(negotiateLocale('de,fr;q=0.8,*;q=0.1', config)).toBe('pl');
    expect(negotiateLocale('en;q=0', config)).toBe('pl');
    expect(negotiateLocale('en;q=abc', config)).toBe('pl');
  });
});

describe('createLocaleMiddleware', () => {
  const middleware = createLocaleMiddleware(config);
  const request = (path: string, language?: string) =>
    new Request(`https://site.test${path}`, {
      ...(language === undefined ? {} : { headers: { 'accept-language': language } }),
    });

  it('redirects only the bare root, by Accept-Language, keeping the query', () => {
    const response = middleware(request('/?utm=x', 'en'));
    expect(response?.status).toBe(307);
    expect(response?.headers.get('Location')).toBe('https://site.test/en?utm=x');
    expect(response?.headers.get('Vary')).toBe('Accept-Language');
    expect(middleware(request('/'))?.headers.get('Location')).toBe('https://site.test/pl');
  });

  it('leaves every other path alone, so cached pages never depend on a header', () => {
    expect(middleware(request('/pl/about', 'en'))).toBeUndefined();
    expect(middleware(request('/en'))).toBeUndefined();
  });
});

describe('generateLocaleStaticParams', () => {
  it('gives every language its published slugs, the home page without one', async () => {
    const params = await generateLocaleStaticParams({
      locales: ['pl', 'en'],
      slugs: async (locale) =>
        locale === 'pl' ? ['home', 'o-nas', 'blog/wpis'] : ['home', 'about'],
    });
    expect(params).toEqual([
      { locale: 'pl' },
      { locale: 'pl', slug: ['o-nas'] },
      { locale: 'pl', slug: ['blog', 'wpis'] },
      { locale: 'en' },
      { locale: 'en', slug: ['about'] },
    ]);
  });
});

describe('isLocale', () => {
  it('guards a route segment', () => {
    expect(isLocale('pl', config)).toBe(true);
    expect(isLocale('de', config)).toBe(false);
    expect(isLocale(undefined, config)).toBe(false);
  });
});

describe('hreflang', () => {
  it('adds x-default for the default language', () => {
    expect(
      buildrMetadata(
        { alternates: { pl: '/pl/o-nas', en: '/en/about' }, locale: 'pl' },
        { defaultLocale: 'pl' },
      ).alternates?.languages,
    ).toEqual({ pl: '/pl/o-nas', en: '/en/about', 'x-default': '/pl/o-nas' });
    expect(buildrMetadata({ alternates: { pl: '/pl' } }).alternates?.languages).toEqual({
      pl: '/pl',
    });
  });
});

describe('withLocalePrefix', () => {
  const locales = ['pl', 'en'];
  it('prefixes a path that has no language yet', () => {
    expect(withLocalePrefix('/about', 'en', locales)).toBe('/en/about');
    expect(withLocalePrefix('/', 'pl', locales)).toBe('/pl');
    expect(withLocalePrefix('/about?x=1', 'pl', locales)).toBe('/pl/about?x=1');
  });
  it('leaves a path that has one, or an unknown language, alone', () => {
    expect(withLocalePrefix('/pl/about', 'en', locales)).toBe('/pl/about');
    expect(withLocalePrefix('/en', 'en', locales)).toBe('/en');
    expect(withLocalePrefix('/about', 'de', locales)).toBe('/about');
    expect(withLocalePrefix('/about', null, locales)).toBe('/about');
    expect(withLocalePrefix('/about', 'en', undefined)).toBe('/about');
  });
});
