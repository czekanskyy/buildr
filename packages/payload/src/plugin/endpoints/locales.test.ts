import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { processLayout } from '../hooks/process-layout.ts';
import { chooseLocale, configuredLocales, localeConfigOf } from '../locales.ts';
import { boot, type Harness, meta, migrations, withChild } from './endpoints.test-kit.ts';

let h: Harness;
let id: string | number;
beforeAll(async () => {
  h = await boot(
    'locales',
    {},
    {
      localization: {
        locales: [
          { code: 'pl', label: 'Polski' },
          { code: 'en', label: 'English' },
        ],
        defaultLocale: 'pl',
        fallback: true,
      },
    },
  );
  const page = await h.payload.create({
    collection: 'pages',
    data: { title: 'Cześć', slug: 'czesc' } as never,
    draft: true,
    locale: 'pl',
  });
  id = page.id;
  await h.payload.update({
    collection: 'pages',
    id,
    data: { title: 'Hello' } as never,
    draft: true,
    locale: 'en',
  });
});
afterAll(() => h.close());

const titleIn = async (locale?: string) => {
  const query = `collection=pages&id=${id}${locale === undefined ? '' : `&locale=${locale}`}`;
  const { status, body } = await h.call('GET', `/buildr/data/context?${query}`);
  expect(status).toBe(200);
  return { title: body.scopes.page.title, route: body.scopes.route };
};

describe('locales', () => {
  it('derives the LocaleConfig from the Payload localization', () => {
    expect(configuredLocales(h.payload.config)).toEqual({
      locales: ['pl', 'en'],
      default: 'pl',
      fallback: true,
      intl: { pl: 'Polski', en: 'English' },
    });
  });

  it('builds the data context of a post in both languages', async () => {
    expect(await titleIn('pl')).toMatchObject({ title: 'Cześć', route: { locale: 'pl' } });
    expect(await titleIn('en')).toMatchObject({ title: 'Hello', route: { locale: 'en' } });
    // No locale means the default language.
    expect(await titleIn()).toMatchObject({ title: 'Cześć', route: { locale: 'pl' } });
  });

  it('falls back to the default language for a missing translation', async () => {
    const page = await h.payload.create({
      collection: 'pages',
      data: { title: 'Tylko polski', slug: 'pl-only' } as never,
      draft: true,
      locale: 'pl',
    });
    const { body } = await h.call(
      'GET',
      `/buildr/data/context?collection=pages&id=${page.id}&locale=en`,
    );
    expect(body.scopes.page.title).toBe('Tylko polski');
  });

  it('opens a document in the language asked for', async () => {
    const opened = await h.call('GET', `/buildr/documents/pages/${id}?locale=en`);
    expect(opened.status).toBe(200);
    expect(opened.body.title).toBe('Hello');
    expect((await h.call('GET', `/buildr/documents/pages/${id}`)).body.title).toBe('Cześć');
  });

  it('lists samples with the titles of the language', async () => {
    const en = await h.call('GET', '/buildr/samples/pages?locale=en');
    expect(en.body.items.map((item: { title: string }) => item.title)).toContain('Hello');
    const pl = await h.call('GET', '/buildr/samples/pages');
    expect(pl.body.items.map((item: { title: string }) => item.title)).toContain('Cześć');
  });

  it('answers 400 for a locale that is not configured, on every endpoint that takes one', async () => {
    const calls = [
      h.call('GET', `/buildr/documents/pages/${id}?locale=de`),
      h.call('GET', `/buildr/data/context?collection=pages&id=${id}&locale=de`),
      h.call('GET', '/buildr/samples/pages?locale=de'),
      h.call('GET', '/buildr/samples/pages?locale=all'),
      h.call('POST', '/buildr/data/query', {
        body: {
          spec: { source: 'pages', limit: 1, page: 1 },
          locale: 'de',
        },
      }),
      h.call('POST', '/buildr/data/media', { body: { ids: [], locale: 'de' } }),
    ];
    for (const { status, body } of await Promise.all(calls)) {
      expect(status).toBe(400);
      expect(body.error).toMatch(/locale/);
    }
  });

  it('reports an l10n key outside the configured languages as a warning', () => {
    const doc = withChild({
      title: { kind: 'static', value: 'Hi', l10n: { pl: 'Cześć', de: 'Hallo' } },
    });
    const options = {
      registry: { meta, migrations },
      limits: { maxNodes: 5000, maxBytes: 2_000_000 },
    };
    const withLocales = processLayout(doc, {
      ...options,
      locales: configuredLocales(h.payload.config),
    });
    expect(withLocales.ok).toBe(true);
    if (withLocales.ok) {
      expect(withLocales.warnings.some((warning) => JSON.stringify(warning).includes('de'))).toBe(
        true,
      );
    }
    const without = processLayout(doc, options);
    expect(
      without.ok && without.warnings.every((warning) => !JSON.stringify(warning).includes('"de"')),
    ).toBe(true);
  });
});

describe('without localization', () => {
  const plain = { payload: { config: { localization: false } } } as never;

  it('behaves as before: one locale, the parameter is ignored', () => {
    expect(chooseLocale(plain, 'de')).toEqual({ ok: true, locale: undefined, args: {} });
    expect(chooseLocale(plain, undefined)).toEqual({ ok: true, locale: undefined, args: {} });
    expect(localeConfigOf({ localization: false } as never)).toEqual({
      locales: ['en'],
      default: 'en',
      fallback: false,
      intl: { en: 'English' },
    });
  });
});
