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
      // No zone overflows its grid track, and the row itself does not scroll.
      await expect
        .poll(() => row.evaluate((el) => el.scrollWidth - el.clientWidth))
        .toBeLessThanOrEqual(0);
      await expect
        .poll(() =>
          row.evaluate((el) =>
            Math.max(
              ...[...el.querySelectorAll<HTMLElement>('.bd-toolbar-cluster')].map(
                (zone) => zone.scrollWidth - zone.clientWidth,
              ),
            ),
          ),
        )
        .toBeLessThanOrEqual(0);
      await expect(page.locator('.bd-brand')).toBeInViewport({ ratio: 1 });
      // The panel toggles are there at every width.
      await expect(row.getByRole('button', { name: 'Left panel' })).toBeInViewport({ ratio: 1 });
      await expect(row.getByRole('button', { name: 'Inspector panel' })).toBeInViewport({
        ratio: 1,
      });
      await expect(row.getByRole('button', { name: 'Publish', exact: true })).toBeInViewport({
        ratio: 1,
      });
      await expect(row.getByRole('button', { name: /page options/ })).toBeInViewport({ ratio: 1 });
      if (width === 1024) {
        // Rename while there is room, then verify the final collapse leaves the chip without text.
        await page.setViewportSize({ width: 1440, height: 768 });
        await row.getByRole('button', { name: /page options/ }).click();
        const title = page.getByRole('textbox', { name: 'Page name', exact: true });
        await title.fill('A long page title that must truncate at the minimum editor width');
        await title.press('Enter');
        await page.keyboard.press('Escape');
        await page.setViewportSize({ width, height: 768 });
        // The long title never pushes the toolbar wider: it is cut with an ellipsis, or hidden at the last level.
        await expect
          .poll(() =>
            page.locator('.bd-page-chip-title').evaluate((el) => {
              const rects = el.getClientRects().length;
              return rects === 0 || el.scrollWidth > el.clientWidth;
            }),
          )
          .toBe(true);
        await expect
          .poll(() => row.evaluate((el) => el.scrollWidth - el.clientWidth))
          .toBeLessThanOrEqual(0);
        await expect(row.getByRole('button', { name: /page options/ })).toBeInViewport({
          ratio: 1,
        });
      }
      if (width === 1440) {
        const saved = row.locator('.bd-save-status');
        await expect(saved).toHaveAttribute('data-compact', 'false');
        const picker = row.getByRole('button', { name: /Content language/ });
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
