import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { boot, type Harness } from './endpoints.test-kit.ts';

let h: Harness;
beforeAll(async () => {
  h = await boot(
    'locales-no-fallback',
    {},
    {
      localization: {
        locales: [
          { code: 'pl', label: 'Polski' },
          { code: 'en', label: 'English' },
        ],
        defaultLocale: 'pl',
        fallback: false,
      },
    },
  );
});
afterAll(() => h.close());

describe('localization with fallback off', () => {
  it('does not fall back to the default language and says so in the session', async () => {
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
    expect(body.scopes.page.title ?? null).toBeNull();

    const session = await h.call('GET', '/buildr/session');
    expect(session.body.locales).toMatchObject({ default: 'pl', fallback: false });
  });
});
