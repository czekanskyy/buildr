import { expect, type Page, test } from '@playwright/test';

// The editor in the states listed by PB-118, light and dark, at two window sizes. Every state is
// seeded through `/?seed=..&theme=..` (no storage, seeded ids), the canvas is awaited through the
// host's `data-status="ready"` (the `canvas:ready` handshake), and animations are disabled.
// Baselines are only valid when taken in the Playwright Docker image: see .github/workflows/visual.yml.
const sizes = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const;
const themes = ['light', 'dark'] as const;

async function open(page: Page, seed: 'empty' | 'landing', theme: (typeof themes)[number]) {
  await page.goto(`/?seed=${seed}&theme=${theme}`);
  await expect(page.locator('.buildr-editor')).toHaveAttribute('data-theme', theme);
  await expect(page.locator('.bd-canvas-host')).toHaveAttribute('data-status', 'ready');
  if (seed === 'landing') {
    await expect(
      page
        .frameLocator('iframe')
        .getByRole('heading', { name: 'A headline that says what you do' }),
    ).toBeVisible();
  }
  // Nothing may still be loading or typing a caret into a screenshot.
  await page.addStyleTag({
    content: '*, *::before, *::after { caret-color: transparent !important; }',
  });
}

async function expandLayers(page: Page) {
  await page.getByRole('tab', { name: 'Layers' }).click();
  // Expanding a row adds its children, so look again until every row is open.
  for (let round = 0; round < 6; round++) {
    const closed = page.locator('[role="treeitem"][aria-expanded="false"]');
    if ((await closed.count()) === 0) return;
    await closed.first().locator('[data-toggle]').first().click();
  }
}

async function selectHero(page: Page) {
  await page.getByRole('tab', { name: 'Layers' }).click();
  await page.getByRole('treeitem', { name: /Hero/ }).first().click();
}

const shot = (page: Page, name: string) =>
  expect(page).toHaveScreenshot(`editor-${name}.png`, { animations: 'disabled' });

for (const theme of themes) {
  for (const size of sizes) {
    test.describe(`${theme} ${size.width}x${size.height}`, () => {
      test.use({ viewport: size, reducedMotion: 'reduce' });
      const name = (state: string) => `${state}-${theme}-${size.width}`;

      test('empty document', async ({ page }) => {
        await open(page, 'empty', theme);
        await shot(page, name('empty'));
      });

      for (const tab of ['Content', 'Style', 'Advanced'] as const) {
        test(`hero selected, ${tab} tab`, async ({ page }) => {
          await open(page, 'landing', theme);
          await selectHero(page);
          await page.getByRole('tab', { name: tab }).click();
          await shot(page, name(`hero-${tab.toLowerCase()}`));
        });
      }

      test('layers tab expanded', async ({ page }) => {
        await open(page, 'landing', theme);
        await expandLayers(page);
        await shot(page, name('layers'));
      });

      test('insert tab scrolled to templates', async ({ page }) => {
        await open(page, 'landing', theme);
        await page.getByRole('heading', { name: 'Templates' }).scrollIntoViewIfNeeded();
        await shot(page, name('insert-templates'));
      });

      test('publish dialog', async ({ page }) => {
        await open(page, 'landing', theme);
        await page.getByRole('button', { name: 'Publish' }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await shot(page, name('publish'));
      });

      test('media picker', async ({ page }) => {
        await open(page, 'landing', theme);
        await expandLayers(page);
        await page.getByRole('treeitem', { name: /Image/ }).first().click();
        await page.getByRole('button', { name: 'Choose file' }).first().click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page.getByText('No files found.')).toBeVisible();
        await shot(page, name('media-picker'));
      });

      test('issues panel open', async ({ page }) => {
        await open(page, 'landing', theme);
        // The page is only checked after an edit or when publishing is attempted: open the publish
        // dialog to run the check, close it, then open the panel.
        await page.getByRole('button', { name: 'Publish' }).click();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await page.getByRole('button', { name: 'Show issues' }).click();
        await expect(page.getByText('Checking the page…')).toHaveCount(0);
        await shot(page, name('issues'));
      });
    });
  }

  for (const [breakpoint, label] of [
    ['tablet', 'Tablet'],
    ['mobile', 'Mobile'],
  ] as const) {
    for (const size of sizes) {
      test(`${theme} canvas at ${breakpoint} ${size.width}x${size.height}`, async ({ browser }) => {
        const context = await browser.newContext({ viewport: size, reducedMotion: 'reduce' });
        const page = await context.newPage();
        await open(page, 'landing', theme);
        await page.getByRole('button', { name: label, exact: true }).click();
        await expect(page.locator('.bd-canvas-host')).toHaveAttribute('data-status', 'ready');
        await shot(page, `${breakpoint}-${theme}-${size.width}`);
        await context.close();
      });
    }
  }
}
