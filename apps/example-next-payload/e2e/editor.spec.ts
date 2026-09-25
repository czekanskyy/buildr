import { test as base, expect, type Page } from '@playwright/test';

const credentials = { email: 'e2e@buildr.test', password: 'e2e-password-1' };
const HEADLINE = 'Strony, które budujesz sam, bez czekania na programistę';

interface Scratch {
  readonly id: number;
  readonly slug: string;
  /** Opens the editor on the scratch page and waits for the canvas to render it. */
  readonly open: () => Promise<{ page: Page; canvas: ReturnType<Page['frameLocator']> }>;
}

let counter = 0;

/**
 * Every test edits its own page (a copy of the seeded landing page), so tests never depend on each
 * other and the public-site tests keep seeing the seed. The login goes through Payload's REST API.
 */
const test = base.extend<{ scratch: Scratch }>({
  scratch: async ({ page }, use, testInfo) => {
    const request = page.request;
    const login = await request.post('/api/users/login', { data: credentials });
    expect(login.ok()).toBe(true);
    const home = (await (
      await request.get('/api/pages?where[slug][equals]=home&locale=pl&draft=true&limit=1')
    ).json()) as { docs: { layout: unknown }[] };
    const slug = `e2e-${testInfo.workerIndex}-${Date.now()}-${counter++}`;
    const created = await request.post('/api/pages?locale=pl', {
      data: { title: 'Scratch', slug, layout: home.docs[0]?.layout, _status: 'published' },
    });
    expect(created.ok()).toBe(true);
    const id = ((await created.json()) as { doc: { id: number } }).doc.id;
    // The English slug, so the page has an address in both languages.
    const english = await request.patch(`/api/pages/${String(id)}?locale=en`, {
      data: { title: 'Scratch', slug, _status: 'published' },
    });
    expect(english.ok()).toBe(true);
    await use({
      id,
      slug,
      open: async () => {
        await page.goto(`/buildr/edit/pages/${String(id)}`);
        const canvas = page.frameLocator('iframe');
        await expect(canvas.getByRole('heading', { name: HEADLINE })).toBeVisible();
        return { page, canvas };
      },
    });
    await request.delete(`/api/pages/${String(id)}`);
  },
});

/** Publishes from the toolbar through the confirmation dialog. */
async function publish(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByText('Published.')).toBeVisible();
}

const saved = (page: Page) => page.getByRole('status').filter({ hasText: 'All changes saved' });

test('the editor opens a page and the canvas finishes its handshake', async ({ scratch }) => {
  await scratch.open();
});

test('insert a section, undo and redo, autosave, reload', async ({ scratch }) => {
  const { page, canvas } = await scratch.open();
  await page.getByRole('searchbox', { name: 'Search components and templates' }).fill('faq');
  await page.getByRole('button', { name: 'FAQ', exact: true }).first().click();
  await expect(canvas.getByRole('heading', { name: 'Frequently asked questions' })).toBeVisible();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(canvas.getByRole('heading', { name: 'Frequently asked questions' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(canvas.getByRole('heading', { name: 'Frequently asked questions' })).toBeVisible();

  // Nobody pressed Save: the editor saves by itself.
  await expect
    .poll(async () =>
      JSON.stringify(
        (await (await page.request.get(`/api/pages/${scratch.id}?draft=true&locale=pl`)).json())
          .layout,
      ).includes('Frequently asked questions'),
    )
    .toBe(true);
  await expect(saved(page)).toBeVisible();
  await page.reload();
  await expect(canvas.getByRole('heading', { name: 'Frequently asked questions' })).toBeVisible();
});

test('a style set on mobile does not leak to desktop', async ({ scratch }) => {
  const { page, canvas } = await scratch.open();
  const heading = canvas.getByRole('heading', { name: HEADLINE });
  await heading.click();
  await page.getByRole('button', { name: 'Mobile' }).click();
  await page.getByRole('tab', { name: 'Style' }).click();
  // A group opens by itself when it already has values, so open it rather than toggle it.
  await page
    .locator('details', { hasText: 'Typography' })
    .first()
    .evaluate((d: HTMLDetailsElement) => {
      d.open = true;
    });
  await page.getByRole('combobox', { name: 'Text align' }).selectOption('right');
  const align = () => heading.evaluate((element) => getComputedStyle(element).textAlign);
  await expect.poll(align).toBe('right');
  await page.getByRole('button', { name: 'Desktop' }).click();
  await expect.poll(align).not.toBe('right');
});

test('a heading bound to data previews the data and publishes it', async ({ scratch }) => {
  const { page, canvas } = await scratch.open();
  await canvas.getByRole('heading', { name: HEADLINE }).click();
  await page.getByRole('button', { name: 'Data', exact: true }).first().click();
  await page.getByRole('button', { name: /^page.title/ }).click();
  await expect(page.getByText('Bound to data:')).toBeVisible();
  await expect(page.getByText('Preview: Scratch')).toBeVisible();

  await publish(page);
  await expect
    .poll(async () =>
      (await (await page.request.get(`/pl/${scratch.slug}`)).text()).includes('>Scratch<'),
    )
    .toBe(true);
});

test('an edited headline reaches the live page when published', async ({ scratch }) => {
  const { page, canvas } = await scratch.open();
  await canvas.getByRole('heading', { name: HEADLINE }).click();
  await page.getByRole('textbox', { name: 'Text', exact: true }).fill('Live from the editor');
  await expect(canvas.getByRole('heading', { name: 'Live from the editor' })).toBeVisible();
  await publish(page);
  await page.goto(`/pl/${scratch.slug}`);
  await expect(page.getByRole('heading', { name: 'Live from the editor' })).toBeVisible();
});

test('translating a heading shows the translation on /en, after publishing', async ({
  scratch,
}) => {
  const { page, canvas } = await scratch.open();
  await page.getByRole('combobox', { name: 'Content language' }).click();
  await page.getByRole('option', { name: 'en' }).click();
  await canvas
    .getByRole('heading', { name: 'Pages you build yourself, without waiting for a developer' })
    .click();
  await page
    .getByRole('textbox', { name: 'Text', exact: true })
    .fill('Translated by the e2e suite');
  await expect(canvas.getByRole('heading', { name: 'Translated by the e2e suite' })).toBeVisible();

  await publish(page);

  await expect
    .poll(async () => {
      const response = await page.request.get(`/en/${scratch.slug}`);
      return (await response.text()).includes('Translated by the e2e suite');
    })
    .toBe(true);
  // The other language is untouched.
  const polish = await page.request.get(`/pl/${scratch.slug}`);
  expect(await polish.text()).toContain(HEADLINE);
});
