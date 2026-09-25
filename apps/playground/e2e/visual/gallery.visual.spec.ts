import { expect, test } from '@playwright/test';

// Every gallery fixture at the three widths of the gallery. Baselines are only valid when taken in
// the Playwright Docker image (fonts and anti-aliasing differ per OS): see .github/workflows/visual.yml.
const fixtures = ['hello', 'styled', 'loop'] as const;
const widths = [375, 768, 1280] as const;

for (const fixture of fixtures) {
  for (const width of widths) {
    test(`${fixture} at ${width}px`, async ({ page }) => {
      await page.goto(`/gallery?fixture=${fixture}&w=${width}`);
      const frame = page.getByTestId('frame');
      await expect(frame).toBeVisible();
      await expect(page.getByTestId('diagnostics')).toHaveText('No diagnostics.');
      await expect(frame).toHaveScreenshot(`${fixture}-${width}.png`, { animations: 'disabled' });
    });
  }
}
