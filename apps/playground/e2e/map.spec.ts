import { expect, type Page, test } from '@playwright/test';

const MAP_TEST_KEY = `FAKE_MAP_KEY_${'0'.repeat(25)}X`;

const query = 'Rynek G\u0142\u00f3wny 1, Krak\u00f3w';
const link = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
const src = `https://www.google.com/maps/embed/v1/place?key=${MAP_TEST_KEY}&q=${encodeURIComponent(query)}&zoom=15&maptype=roadmap&language=en`;
async function blockGoogle(page: Page) {
  const attempts: string[] = [];
  await page.route('**/*google.com*/**', (route) => {
    attempts.push(route.request().url());
    return route.abort();
  });
  return attempts;
}
async function load(page: Page, suffix = '&mapKey=1') {
  await page.goto(`/blocks?entry=map-default${suffix}`);
  await expect(page.getByTestId('frame').locator('.bc-map')).toBeVisible();
  await expect(page.getByTestId('diagnostics')).toHaveText('No diagnostics.');
}
test('loads the exact restricted frame only after consent click', async ({ page }) => {
  const attempts = await blockGoogle(page);
  await load(page);
  const button = page.getByRole('button', { name: 'Show map', exact: true });
  await expect(button).toBeVisible();
  expect(attempts).toEqual([]);
  await expect(page.locator('iframe')).toHaveCount(0);
  await button.click();
  const frame = page.locator('iframe');
  await expect(frame).toHaveCount(1);
  await expect(frame).toHaveAttribute('src', src);
  await expect(frame).toHaveAttribute(
    'sandbox',
    'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox',
  );
  await expect(frame).toHaveAttribute('referrerpolicy', 'strict-origin');
  await expect(frame).toHaveAttribute('loading', 'lazy');
  await expect(frame).not.toHaveAttribute('allow');
  await expect(frame).not.toHaveAttribute('allowfullscreen');
  await expect.poll(() => attempts).toEqual([src]);
});
test('canvas omits the provider even with the host test key opted in elsewhere', async ({
  page,
}) => {
  const attempts = await blockGoogle(page);
  await load(page, '&mapKey=1&mode=canvas');
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByRole('button')).toHaveCount(0);
  expect(await page.getByTestId('frame').innerHTML()).not.toContain(MAP_TEST_KEY);
  expect(attempts).toEqual([]);
});
test('without a key only the keyless link is rendered', async ({ page }) => {
  const attempts = await blockGoogle(page);
  await load(page, '');
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByRole('button')).toHaveCount(0);
  await expect(page.getByTestId('frame').getByRole('link')).toHaveAttribute('href', link);
  expect(attempts).toEqual([]);
});
test('native Tab and Enter load the map and focus its iframe', async ({ page }) => {
  const attempts = await blockGoogle(page);
  await load(page);
  await page.getByTestId('frame').evaluate((el) => {
    el.tabIndex = -1;
    el.focus();
  });
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Show map', exact: true })).toBeFocused();
  expect(attempts).toEqual([]);
  await page.keyboard.press('Enter');
  await expect(page.locator('iframe')).toHaveAttribute('src', src);
  await expect(page.locator('iframe')).toBeFocused();
  await expect.poll(() => attempts).toEqual([src]);
});
test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('server HTML exposes a link and never loads a provider', async ({ page }) => {
    const attempts = await blockGoogle(page);
    await load(page, '&mapKey=1&static=1');
    const anchor = page.getByTestId('frame').getByRole('link');
    await expect(anchor).toBeVisible();
    await expect(anchor).toHaveAttribute('href', link);
    await expect(anchor).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(anchor).toHaveAttribute('target', '_blank');
    await expect(page.locator('iframe')).toHaveCount(0);
    // The click-to-load button is in the server HTML but `hidden` until hydration: dead without JS.
    await expect(page.locator('button')).toBeHidden();
    await expect(page.getByRole('button')).toHaveCount(0);
    expect(attempts).toEqual([]);
  });
});
