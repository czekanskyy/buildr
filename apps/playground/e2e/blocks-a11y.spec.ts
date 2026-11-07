import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Real registry fixtures, including collection-backed Loop children: WCAG 2.0/2.1 A and AA.
for (const entry of [
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
    await page.goto(`/blocks?entry=${entry}&w=768`);
    await expect(page.getByTestId('frame')).toBeVisible();
    await expect(page.getByTestId('frame').locator('.bc-carousel, .bc-gallery')).toBeVisible();
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
