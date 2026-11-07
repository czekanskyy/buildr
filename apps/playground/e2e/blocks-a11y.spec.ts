import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { stubTurnstile, turnstileCalls } from './turnstile-stub.ts';

// Real registry fixtures, including collection-backed Loop children: WCAG 2.0/2.1 A and AA.
for (const entry of [
  'captcha-default',
  'captcha-no-site-key',
  'captcha-invalid-site-key',
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
    const captchaNetwork = entry.startsWith('captcha-') ? await stubTurnstile(page) : undefined;
    await page.route('**/*google.com*/**', (route) => route.abort());
    await page.goto(
      `/blocks?entry=${entry}&w=768${entry === 'map-default' ? '&mapKey=1' : ''}${entry.startsWith('captcha-') ? '&captchaKey=1' : ''}`,
    );
    await expect(page.getByTestId('frame')).toBeVisible();
    await expect(
      page.getByTestId('frame').locator('.bc-carousel, .bc-gallery, .bc-map, [data-bc-captcha]'),
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
    await captchaNetwork?.assertOnlyStub(0);
  });
}

test('loaded captcha has no WCAG 2.0/2.1 A/AA violations', async ({ page }) => {
  const network = await stubTurnstile(page);
  await page.goto('/blocks?entry=captcha-default&captchaKey=1&w=768');
  await page.getByRole('button', { name: 'Load the check', exact: true }).click();
  await expect.poll(() => turnstileCalls(page)).toHaveLength(1);
  const results = await new AxeBuilder({ page })
    .include('[data-testid="frame"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
  await network.assertOnlyStub(1);
});

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
