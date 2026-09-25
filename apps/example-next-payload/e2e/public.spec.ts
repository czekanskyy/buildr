import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

type Locale = 'pl' | 'en';

interface Scenario {
  readonly name: string;
  readonly path: Record<Locale, string>;
  readonly heading: Record<Locale, string>;
}

// The six scenarios of the seed, as a visitor reaches them.
const scenarios: readonly Scenario[] = [
  {
    name: 'landing page',
    path: { pl: '/pl', en: '/en' },
    heading: {
      pl: 'Strony, które budujesz sam, bez czekania na programistę',
      en: 'Pages you build yourself, without waiting for a developer',
    },
  },
  {
    name: 'company page',
    path: { pl: '/pl/about', en: '/en/about' },
    heading: {
      pl: 'Strony, które budujesz sam, bez czekania na programistę',
      en: 'Pages you build yourself, without waiting for a developer',
    },
  },
  {
    name: 'blog listing',
    path: { pl: '/pl/blog', en: '/en/blog' },
    heading: { pl: 'Blog', en: 'Blog' },
  },
  {
    name: 'blog post',
    path: { pl: '/pl/blog/wpis-1', en: '/en/blog/post-1' },
    heading: {
      pl: 'Wpis numer 1: strony bez tajemnic',
      en: 'Post number 1: pages without mystery',
    },
  },
  {
    name: 'product',
    path: { pl: '/pl/products/kubek-ceramiczny', en: '/en/products/ceramic-mug' },
    heading: { pl: 'Kubek ceramiczny', en: 'Ceramic mug' },
  },
  {
    name: 'contact page',
    path: { pl: '/pl/contact', en: '/en/contact' },
    heading: { pl: 'Skontaktuj się', en: 'Get in touch' },
  },
];

for (const locale of ['pl', 'en'] as const) {
  test.describe(`public site in ${locale}`, () => {
    for (const scenario of scenarios) {
      test(`${scenario.name} renders`, async ({ page }) => {
        const response = await page.goto(scenario.path[locale]);
        expect(response?.status()).toBe(200);
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        await expect(
          page.getByRole('heading', { name: scenario.heading[locale] }).first(),
        ).toBeVisible();
      });

      test(`${scenario.name} has no accessibility violations`, async ({ page }) => {
        await page.goto(scenario.path[locale]);
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      });
    }
  });
}

test('an unknown locale and an unknown page are 404s', async ({ page }) => {
  expect((await page.goto('/de'))?.status()).toBe(404);
  expect((await page.goto('/pl/does-not-exist'))?.status()).toBe(404);
});

test('the bare root redirects to a locale', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/(pl|en)$/);
});

test.describe('hreflang', () => {
  for (const scenario of scenarios) {
    test(`${scenario.name} links its translations`, async ({ page }) => {
      await page.goto(scenario.path.pl);
      const alternates = await page
        .locator('link[rel="alternate"][hreflang]')
        .evaluateAll((links) =>
          Object.fromEntries(
            links.map((link) => [
              link.getAttribute('hreflang'),
              new URL((link as HTMLLinkElement).href).pathname,
            ]),
          ),
        );
      expect(alternates).toMatchObject({
        pl: scenario.path.pl,
        en: scenario.path.en,
      });
      expect(Object.keys(alternates)).toContain('x-default');
    });
  }
});

test('the language of a page follows the URL, not the other way round', async ({ page }) => {
  await page.goto('/en/blog/post-1');
  await expect(
    page.getByRole('heading', { name: 'Post number 1: pages without mystery' }),
  ).toBeVisible();
  await expect(page.getByText('Wpis numer 1')).toHaveCount(0);
});

test('blog pagination shows the second page', async ({ page }) => {
  await page.goto('/en/blog');
  await expect(page.getByRole('article')).toHaveCount(6);
  await page.goto('/en/blog/page/2');
  await expect(page.getByRole('article')).toHaveCount(2);
});

test('a blog card links to its post in the same language', async ({ page }) => {
  await page.goto('/en/blog');
  const first = page.getByRole('article').first().getByRole('link');
  await expect(first).toHaveAttribute('href', /^\/en\/blog\/post-\d+$/);
  await first.click();
  await expect(page).toHaveURL(/\/en\/blog\/post-\d+$/);
  await page.goto('/pl/blog');
  await expect(page.getByRole('article').first().getByRole('link')).toHaveAttribute(
    'href',
    /^\/pl\/blog\/wpis-\d+$/,
  );
});

test('a static page ships no builder code', async ({ page }) => {
  const scripts: string[] = [];
  page.on('response', (response) => {
    if (response.request().resourceType() === 'script') scripts.push(response.url());
  });
  await page.goto('/en');
  await page.waitForLoadState('networkidle');
  const builder = scripts.filter((url) => /editor|canvas|buildr\/edit|dnd-kit|zustand/i.test(url));
  expect(builder).toEqual([]);
});
