import { expect, test } from '@playwright/test';

for (const theme of ['light', 'dark']) {
  for (const width of [1024, 1280, 1440]) {
    test(`toolbar fits at ${width}px, ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 768 });
      await page.goto(`/?seed=landing&theme=${theme}`);
      await expect(page.locator('.bd-canvas-host')).toHaveAttribute('data-status', 'ready', {
        timeout: 15_000,
      });
      const row = page.locator('.bd-toolbar-row');
      await expect
        .poll(() => row.evaluate((el) => el.scrollWidth - el.clientWidth))
        .toBeLessThanOrEqual(0);
      await expect(page.locator('.bd-brand')).toBeInViewport({ ratio: 1 });
      if (width === 1024) {
        await expect(row.getByRole('button', { name: 'Left panel' })).toBeInViewport({ ratio: 1 });
        // Rename while there is room, then verify the final collapse never leaves a sliver.
        await page.setViewportSize({ width: 1440, height: 768 });
        const title = page.getByRole('textbox', { name: 'Page name', exact: true });
        await title.fill('A long page title that must truncate at the minimum editor width');
        await title.press('Enter');
        await page.setViewportSize({ width, height: 768 });
        await expect
          .poll(() => page.locator('.bd-title-input').evaluate((el) => el.getClientRects().length))
          .toBe(0);
        await expect(page.locator('.bd-toolbar-heading')).toHaveCSS('display', 'none');
        await expect
          .poll(() => row.evaluate((el) => el.scrollWidth - el.clientWidth))
          .toBeLessThanOrEqual(0);
        await expect(page.locator('.bd-title-input')).toHaveCSS('text-overflow', 'ellipsis');
        await expect(row.getByRole('button', { name: 'Publish', exact: true })).toBeInViewport({
          ratio: 1,
        });
      }
      if (width === 1440) {
        const saved = row.locator('.bd-save-status');
        await expect(saved).toHaveAttribute('data-compact', 'false');
        const picker = row.getByRole('combobox', { name: 'Content language' });
        await expect
          .poll(async () => {
            const statusBox = await saved.boundingBox();
            const pickerBox = await picker.boundingBox();
            return statusBox && pickerBox ? pickerBox.x - statusBox.x - statusBox.width : 0;
          })
          .toBeGreaterThanOrEqual(8);
      }
    });
  }
}
