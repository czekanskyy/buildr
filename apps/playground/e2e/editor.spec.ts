import { expect, test } from '@playwright/test';

test('insert a Hero, edit text, undo, reload', async ({ page }) => {
  await page.goto('/?uiLocale=en');
  const canvas = page.frameLocator('iframe');
  await expect(canvas.getByRole('heading', { name: 'Welcome to Buildr' })).toBeVisible();

  // Insert a Hero from the palette.
  await page.getByRole('button', { name: 'Patterns', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search patterns' }).fill('hero');
  await page
    .getByRole('button', { name: 'Insert pattern: Banner with image', exact: true })
    .click();
  await expect(
    canvas.getByRole('heading', { name: 'A headline that says what you do' }),
  ).toBeVisible();

  // Edit the text of the first heading from the inspector.
  await canvas.getByRole('heading', { name: 'Welcome to Buildr' }).click();
  await page.getByRole('textbox', { name: 'Text', exact: true }).fill('Edited title');
  await expect(canvas.getByRole('heading', { name: 'Edited title' })).toBeVisible();

  // Undo takes the edit back, then the change is saved and survives a reload.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(canvas.getByRole('heading', { name: 'Welcome to Buildr' })).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
  await page.reload();
  await expect(
    canvas.getByRole('heading', { name: 'A headline that says what you do' }),
  ).toBeVisible();
});

test('the version history button calls the host and the playground shows a note', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?theme=light&uiLocale=pl');
  await expect(page.locator('.bd-canvas-host')).toHaveAttribute('data-status', 'ready', {
    timeout: 15_000,
  });
  await page.getByRole('button', { name: 'Historia wersji' }).click();
  await expect(page.getByTestId('history-note')).toContainText('Historia wersji');
});
