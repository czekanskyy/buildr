import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// The gallery pages, checked against WCAG 2.0/2.1 A and AA. (The example application's pages are
// checked in apps/example-next-payload/e2e/public.spec.ts.)
for (const fixture of ['hello', 'styled', 'loop']) {
  test(`gallery fixture "${fixture}" has no accessibility violations`, async ({ page }) => {
    await page.goto(`/gallery?fixture=${fixture}`);
    await expect(page.getByTestId('frame')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .include('[data-testid="frame"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}
