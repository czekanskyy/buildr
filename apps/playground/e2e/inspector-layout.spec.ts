import { expect, test } from '@playwright/test';

for (const theme of ['light', 'dark'] as const) {
  for (const width of [1280, 1024]) {
    test(`Style controls fit the inspector at ${width}px, ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/?seed=landing&theme=${theme}&uiLocale=en`);
      await expect(page.locator('.bd-canvas-host')).toHaveAttribute('data-status', 'ready');
      const leftToggle = page.getByRole('button', { name: 'Left panel', exact: true });
      if (await leftToggle.isVisible()) {
        if ((await leftToggle.getAttribute('aria-pressed')) === 'false') await leftToggle.click();
      }
      await page.getByRole('tab', { name: 'Structure', exact: true }).click();
      await page.getByRole('treeitem', { name: /Hero/ }).first().click();
      const toggle = page.getByRole('button', { name: 'Inspector panel', exact: true });
      if (await toggle.isVisible()) {
        if ((await toggle.getAttribute('aria-pressed')) === 'false') await toggle.click();
      }
      await page.getByRole('tab', { name: 'Style', exact: true }).click();
      // Include layout segments, paired fields and the nested spacing rings.
      const sections = page.locator('.bd-props-toggle[aria-expanded="false"]');
      while ((await sections.count()) > 0) await sections.first().click();
      await page.evaluate(() => document.fonts.ready);

      const issues = await page.locator('.bd-styles').evaluate((root) => {
        const problems: string[] = [];
        for (const element of root.querySelectorAll<HTMLElement>('*')) {
          if (!(element instanceof HTMLElement) || element.clientWidth === 0) continue;
          // Hidden decoration (the slider's value bubble) is not a control that can collide.
          if (element.closest('[aria-hidden="true"]') !== null) continue;
          // Text overflowing a segment can collide even when the buttons' boxes do not.
          // The slider's value bubble hangs outside the track by design while the thumb is held.
          if (element.scrollWidth > element.clientWidth + 1 && !element.matches('.bd-slider')) {
            problems.push(`overflow: ${element.className}`);
          }
          const children = [...element.children].filter(
            // Absolutely placed corner labels sit on top of their box by design.
            (child): child is HTMLElement =>
              child instanceof HTMLElement && getComputedStyle(child).position !== 'absolute',
          );
          for (let i = 0; i < children.length; i++) {
            for (let j = i + 1; j < children.length; j++) {
              const a = children[i]?.getBoundingClientRect();
              const b = children[j]?.getBoundingClientRect();
              if (
                a !== undefined &&
                b !== undefined &&
                Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
                Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
              ) {
                problems.push(`overlap: ${element.className}`);
              }
            }
          }
        }
        return problems;
      });
      expect(issues).toEqual([]);
    });
  }

  test(`small-screen notice replaces the inspector, ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 300, height: 800 });
    await page.goto(`/?seed=landing&theme=${theme}&uiLocale=en`);
    await expect(page.getByRole('alert')).toContainText('The editor needs a bigger screen');
    await expect(page.getByRole('tab', { name: 'Style', exact: true })).toHaveCount(0);
    const fits = await page.getByRole('alert').evaluate((element) => {
      return element.scrollWidth <= element.clientWidth;
    });
    expect(fits).toBe(true);
  });
}
