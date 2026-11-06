import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { expectTwoIssueRows, showUndoToast } from './feedback.ts';

// PB-131: axe against every state of the editor visual baseline (PB-118), in both themes.
const themes = ['light', 'dark'] as const;
const heading = 'A headline that says what you do';

async function open(page: Page, seed: 'empty' | 'landing', theme: (typeof themes)[number]) {
  await page.goto(`/?seed=${seed}&theme=${theme}&uiLocale=en`);
  await expect(page.locator('.buildr-editor')).toHaveAttribute('data-theme', theme);
  await expect(page.locator('.bd-canvas-host')).toHaveAttribute('data-status', 'ready');
  if (seed === 'landing') {
    await expect(page.frameLocator('iframe').getByRole('heading', { name: heading })).toBeVisible();
  }
}

async function selectHero(page: Page) {
  await page.getByRole('tab', { name: 'Structure' }).click();
  await page.getByRole('treeitem', { name: /Hero/ }).first().click();
}

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    results.violations.map(
      (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target).join(' | ')})`,
    ),
  ).toEqual([]);
}

for (const theme of themes) {
  test.describe(`editor a11y, ${theme}`, () => {
    test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });

    test('empty document', async ({ page }) => {
      await open(page, 'empty', theme);
      await expectNoViolations(page);
    });

    for (const tab of ['Content', 'Style', 'Advanced'] as const) {
      test(`hero selected, ${tab} tab`, async ({ page }) => {
        await open(page, 'landing', theme);
        await selectHero(page);
        await page.getByRole('tab', { name: tab }).click();
        await expectNoViolations(page);
      });
    }

    test('layers, insert tab and templates', async ({ page }) => {
      await open(page, 'landing', theme);
      await page.getByRole('button', { name: 'Patterns', exact: true }).click();
      await expectNoViolations(page);
      await page.getByRole('tab', { name: 'Structure' }).click();
      await expectNoViolations(page);
    });

    test('publish dialog', async ({ page }) => {
      await open(page, 'landing', theme);
      await page.getByRole('button', { name: 'Publish' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expectNoViolations(page);
    });

    test('media picker', async ({ page }) => {
      await open(page, 'landing', theme);
      await page.getByRole('tab', { name: 'Structure' }).click();
      for (let round = 0; round < 6; round++) {
        const closed = page.locator('[role="treeitem"][aria-expanded="false"]');
        if ((await closed.count()) === 0) break;
        await closed.first().locator('[data-toggle]').first().click();
      }
      await page.getByRole('treeitem', { name: /Image/ }).first().click();
      await page.getByRole('button', { name: 'Choose file' }).first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expectNoViolations(page);
    });

    test('issues panel', async ({ page }) => {
      await open(page, 'landing', theme);
      await page.getByRole('button', { name: 'Publish' }).click();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.locator('.bd-status-btn[aria-controls]').click();
      await expect(page.getByText('Checking the page…')).toHaveCount(0);
      await expectTwoIssueRows(page);
      await expectNoViolations(page);
    });

    test('toast with undo and dismiss', async ({ page }) => {
      await open(page, 'landing', theme);
      const toast = await showUndoToast(page);
      const dismiss = toast.getByRole('button', { name: 'Dismiss notification' });
      await expect(dismiss).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(dismiss.locator('svg')).toHaveAttribute('stroke', 'currentColor');
      // Enter through the keyboard: programmatic focus after a pointer click need not match :focus-visible.
      await dismiss.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(dismiss).toBeFocused();
      await expect(dismiss).toHaveCSS('outline-style', 'solid');
      await expect(dismiss).toHaveCSS('outline-width', '2px');
      await expectNoViolations(page);
      await toast.getByRole('button', { name: 'Undo', exact: true }).click();
      await expect(
        page.frameLocator('iframe').getByRole('heading', { name: heading }),
      ).toBeVisible();
      await expect(toast).toHaveCount(0);
      await showUndoToast(page);
      await toast.getByRole('button', { name: 'Dismiss notification' }).click();
      await expect(toast).toHaveCount(0);
    });

    test('Polish toast with Cofnij and dismiss', async ({ page }) => {
      await page.goto(`/?seed=landing&theme=${theme}&uiLocale=pl`);
      await expect(page.locator('.bd-canvas-host')).toHaveAttribute('data-status', 'ready');
      const toast = await showUndoToast(page, 'pl');
      await expectNoViolations(page);
      await toast.getByRole('button', { name: 'Cofnij', exact: true }).click();
      await expect(
        page.frameLocator('iframe').getByRole('heading', { name: heading }),
      ).toBeVisible();
      await expect(toast).toHaveCount(0);
    });

    for (const label of ['Tablet', 'Mobile']) {
      test(`canvas at ${label}`, async ({ page }) => {
        await open(page, 'landing', theme);
        await page.getByRole('button', { name: label, exact: true }).click();
        await expect(page.locator('.bd-canvas-host')).toHaveAttribute('data-status', 'ready');
        await expectNoViolations(page);
      });
    }
  });
}
