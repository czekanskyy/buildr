import { expect, test } from '@playwright/test';

async function openAdvanced(page: import('@playwright/test').Page, search: string) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/?seed=landing&theme=light&uiLocale=en${search}`);
  await expect(page.locator('.bd-canvas-host')).toHaveAttribute('data-status', 'ready', {
    timeout: 15_000,
  });
  await page.getByRole('tab', { name: 'Structure', exact: true }).click();
  await page.getByRole('treeitem', { name: /Hero/ }).first().click();
  await page.getByRole('tab', { name: 'Advanced', exact: true }).click();
}

test('motion presets are on the Style tab', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?seed=landing&theme=light&uiLocale=en');
  await expect(page.locator('.bd-canvas-host')).toHaveAttribute('data-status', 'ready', {
    timeout: 15_000,
  });
  await page.getByRole('tab', { name: 'Structure', exact: true }).click();
  await page.getByRole('treeitem', { name: /Hero/ }).first().click();
  await page.getByRole('tab', { name: 'Style', exact: true }).click();
  const section = page.locator('.bd-sec[data-group="motion"]');
  await section.locator('.bd-sec__head').click();
  await section.locator('.bd-motion-presets button').nth(1).click();
  await expect(section.locator('[data-style-prop="motion.entranceDuration"]')).toBeVisible();
});

test('custom classes and CSS reach the canvas only while author code is enabled', async ({
  page,
}) => {
  await openAdvanced(page, '');
  await page.getByRole('button', { name: 'CSS classes' }).click();
  await page.locator('[data-attr="classes"] input').fill('e2e-author');
  await page.keyboard.press('Enter');
  await expect(page.frameLocator('iframe').locator('.e2e-author')).toHaveCount(1);
});

test('?authorCode=0 hides the fields and the effect', async ({ page }) => {
  await openAdvanced(page, '&authorCode=0');
  await page.getByRole('button', { name: 'Custom code' }).click();
  await expect(page.locator('[data-state="author-off"]')).toBeVisible();
  await expect(page.locator('[data-attr="customCss"]')).toHaveCount(0);
  await expect(page.frameLocator('iframe').locator('.e2e-author')).toHaveCount(0);
});
