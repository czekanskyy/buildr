import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Real registry fixtures, including collection-backed Loop children: WCAG 2.0/2.1 A and AA.
for (const entry of [
  'map-default',
  'map-satellite',
  'map-unicode',
  'map-no-key',
  'map-bound',
  'carousel-default',
  'carousel-autoplay',
  'carousel-bound',
  'carousel-loop',
  'gallery-default',
  'gallery-wide',
  'gallery-auto',
  'gallery-links',
  'gallery-empty',
  'gallery-loop',
]) {
  test(`block fixture "${entry}" has no accessibility violations`, async ({ page }) => {
    await page.route('**/*google.com*/**', (route) => route.abort());
    await page.goto(`/blocks?entry=${entry}&w=768${entry === 'map-default' ? '&mapKey=1' : ''}`);
    await expect(page.getByTestId('frame')).toBeVisible();
    await expect(
      page.getByTestId('frame').locator('.bc-carousel, .bc-gallery, .bc-map'),
    ).toBeVisible();
    if (entry === 'gallery-loop') {
      await expect(page.getByTestId('diagnostics')).toContainText('render.media-snapshot');
    } else {
      await expect(page.getByTestId('diagnostics')).toHaveText('No diagnostics.');
    }
    const results = await new AxeBuilder({ page })
      .include('[data-testid="frame"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}

for (const entry of ['gallery-default', 'gallery-wide', 'gallery-auto', 'gallery-loop']) {
  test(`open lightbox "${entry}" has no accessibility violations`, async ({ page }) => {
    await page.goto(`/blocks?entry=${entry}&w=768`);
    await page.getByTestId('frame').locator('.bc-gallery-item__link').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .include('[data-testid="frame"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}

test('loaded map has no parent-document accessibility violations', async ({ page }) => {
  await page.route('**/*google.com*/**', (route) => route.abort());
  await page.goto('/blocks?entry=map-default&mapKey=1&w=768');
  await page.getByRole('button', { name: 'Show map', exact: true }).click();
  await expect(page.locator('.bc-map iframe')).toHaveCount(1);
  // The aborted cross-origin document is unavailable; audit the parent and iframe title.
  const results = await new AxeBuilder({ page })
    .include('[data-testid="frame"]')
    .disableRules(['frame-tested'])
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
