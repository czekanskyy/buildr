import { expect, type Page } from '@playwright/test';

/** Exercise the real clipboard command and its localized Undo action; focus pauses dismissal. */
export async function showUndoToast(page: Page, locale: 'en' | 'pl' = 'en') {
  const labels =
    locale === 'pl'
      ? { layers: 'Warstwy', undo: 'Cofnij', dismiss: 'Zamknij powiadomienie' }
      : { layers: 'Layers', undo: 'Undo', dismiss: 'Dismiss notification' };
  await page.getByRole('tab', { name: labels.layers }).click();
  await page.getByRole('treeitem', { name: /Hero/ }).first().click();
  await page.keyboard.press('ControlOrMeta+x');
  const toast = page.locator('.bd-toast[data-variant="success"]');
  await expect(toast.getByRole('button', { name: labels.undo, exact: true })).toBeVisible();
  await toast.getByRole('button', { name: labels.dismiss }).focus();
  await page.mouse.move(0, 0);
  return toast;
}

/** Require two complete rows inside the initial drawer viewport, without scrolling. */
export async function expectTwoIssueRows(page: Page) {
  await expect
    .poll(() =>
      page.locator('.bd-issues[data-open="true"]').evaluate((drawer) => {
        const bounds = drawer.getBoundingClientRect();
        return [...drawer.querySelectorAll('.bd-issue')].filter((row) => {
          const rect = row.getBoundingClientRect();
          return rect.height > 0 && rect.top >= bounds.top && rect.bottom <= bounds.bottom;
        }).length;
      }),
    )
    .toBeGreaterThanOrEqual(2);
}
