import { expect, type Page, test } from '@playwright/test';

/** The editor opens in a window of `width` and waits for the canvas. */
async function open(page: Page, width: number, theme = 'light') {
  await page.setViewportSize({ width, height: width <= 480 ? 800 : 768 });
  await page.goto(`/?seed=landing&theme=${theme}&uiLocale=en`);
  await expect(page.locator('.bd-canvas-host')).toHaveAttribute('data-status', 'ready', {
    timeout: 15_000,
  });
}

const onlyOneSheet = (page: Page) =>
  page.evaluate(
    () =>
      [...document.querySelectorAll<HTMLElement>('.bd-body > .bd-panel')].filter((p) => !p.hidden)
        .length,
  );

for (const width of [1024, 768, 390]) {
  test.describe(`responsive editor at ${width}px`, () => {
    test('page and toolbar never overflow the viewport', async ({ page }) => {
      await open(page, width);
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
        .toBeLessThanOrEqual(0);
      const outside = await page.evaluate(() => {
        const limit = window.innerWidth;
        return [...document.querySelectorAll<HTMLElement>('.bd-toolbar button, .bd-toolbar a')]
          .filter((el) => el.getClientRects().length > 0)
          .map((el) => ({
            name: el.getAttribute('aria-label') ?? el.textContent,
            box: el.getBoundingClientRect(),
          }))
          .filter(({ box }) => box.left < -0.5 || box.right > limit + 0.5)
          .map(({ name }) => name);
      });
      expect(outside).toEqual([]);
      // The editor, the canvas and the status bar use the whole width.
      await expect
        .poll(() => page.locator('.bd-canvas').evaluate((el) => el.getBoundingClientRect().width))
        .toBeGreaterThanOrEqual(width - 1);
      await expect(page.locator('.bd-status')).toBeInViewport({ ratio: 1 });
    });

    test('panels are sheets: one at a time, scrim, close button and Escape', async ({ page }) => {
      await open(page, width);
      await expect.poll(() => onlyOneSheet(page)).toBe(0);
      const left = page.getByRole('button', { name: 'Left panel' });
      const right = page.getByRole('button', { name: 'Inspector panel' });
      await left.click();
      await expect(page.locator('.bd-scrim')).toBeVisible();
      await expect.poll(() => onlyOneSheet(page)).toBe(1);
      await right.click();
      await expect.poll(() => onlyOneSheet(page)).toBe(1);
      await expect(page.locator('.bd-panel[data-side="right"]')).toBeVisible();
      // The inspector sheet has its own close button.
      await page.locator('.bd-panel[data-side="right"] .bd-sheet-close').click();
      await expect.poll(() => onlyOneSheet(page)).toBe(0);
      // Escape closes the left sheet; the scrim closes the other.
      await left.click();
      await page.keyboard.press('Escape');
      await expect.poll(() => onlyOneSheet(page)).toBe(0);
      await right.click();
      await page.locator('.bd-scrim').click({ position: { x: 4, y: 100 } });
      await expect.poll(() => onlyOneSheet(page)).toBe(0);
      // The sheet fits the viewport.
      await left.click();
      const box = await page.locator('.bd-panel[data-side="left"]').boundingBox();
      expect(box).not.toBeNull();
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
        .toBeLessThanOrEqual(0);
    });

    test('picking a block on the canvas opens the inspector sheet', async ({ page }) => {
      await open(page, width);
      await page.frameLocator('iframe').getByRole('heading').first().click();
      await expect(page.locator('.bd-panel[data-side="right"]')).toBeVisible();
      await expect.poll(() => onlyOneSheet(page)).toBe(1);
      await page.keyboard.press('Escape');
      // A selection made from the structure panel does not open it.
      await page.getByRole('button', { name: 'Left panel' }).click();
      await page.getByRole('tab', { name: 'Structure' }).click();
      await page.getByRole('treeitem').nth(1).click();
      await expect(page.locator('.bd-panel[data-side="right"]')).toBeHidden();
    });
  });
}

for (const width of [768, 390]) {
  test(`compact toolbar and touch targets at ${width}px`, async ({ page }) => {
    await open(page, width);
    const row = page.locator('.bd-toolbar-row');
    await expect(row.getByRole('button', { name: 'Left panel' })).toBeVisible();
    await expect(row.getByRole('button', { name: /page options/ })).toBeVisible();
    await expect(row.getByRole('button', { name: 'More options' })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Publish', exact: true })).toBeVisible();
    // The device toggle moved into the more menu.
    await expect(row.getByRole('group', { name: 'Screen size' })).toHaveCount(0);
    await row.getByRole('button', { name: 'More options' }).click();
    await page
      .getByRole('group', { name: 'Screen size' })
      .getByRole('button', { name: 'Mobile' })
      .click();
    await expect(page.locator('.bd-canvas-stage')).toBeVisible();
    // Every control of the toolbar and the status bar is at least 36px high and wide (icons) / high (text).
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.bd-toolbar button, .bd-status button')]
        .filter((el) => el.getClientRects().length > 0)
        .map((el) => ({
          name: el.getAttribute('aria-label') ?? el.textContent,
          box: el.getBoundingClientRect(),
        }))
        .filter(({ box }) => box.height < 35.5 || box.width < 35.5)
        .map(({ name, box }) => `${name}: ${box.width}x${box.height}`),
    );
    expect(small).toEqual([]);
  });
}

test('below 320px a polite notice replaces the editor', async ({ page }) => {
  await page.setViewportSize({ width: 300, height: 700 });
  await page.goto('/?seed=landing&theme=light&uiLocale=en');
  await expect(page.getByRole('alert')).toContainText('The editor needs a bigger screen');
});
