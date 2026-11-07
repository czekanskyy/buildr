import { expect, test } from '@playwright/test';

// Every gallery fixture at the three widths of the gallery. Baselines are only valid when taken in
// the Playwright Docker image (fonts and anti-aliasing differ per OS): see .github/workflows/visual.yml.
for (const entry of [
  'carousel-default',
  'carousel-autoplay',
  'gallery-default',
  'gallery-wide',
  'gallery-auto',
]) {
  for (const width of [375, 768, 1280]) {
    test(`${entry} at ${width}px`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(`/blocks?entry=${entry}&w=${width}`);
      const frame = page.getByTestId('frame');
      await expect(frame.locator('.bc-carousel, .bc-gallery')).toBeVisible();
      await expect(page.getByTestId('diagnostics')).toHaveText('No diagnostics.');
      await expect
        .poll(() =>
          frame
            .locator('img[src]')
            .evaluateAll((images) =>
              images.every((image) => image instanceof HTMLImageElement && image.naturalWidth > 0),
            ),
        )
        .toBe(true);
      await expect(frame).toHaveScreenshot(`${entry}-${width}.png`, { animations: 'disabled' });
    });
  }
}
