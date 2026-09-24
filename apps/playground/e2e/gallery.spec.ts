import { expect, test } from '@playwright/test';

test('the gallery lists the fixtures', async ({ page }) => {
  await page.goto('/gallery');
  await expect(page.getByRole('heading', { name: 'Buildr playground' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Hello' })).toBeVisible();
});

test('a fixture renders through DocumentRenderer', async ({ page }) => {
  await page.goto('/gallery?fixture=hello&w=375');
  const frame = page.getByTestId('frame');
  await expect(frame.getByRole('heading', { name: 'Hello, Buildr' })).toBeVisible();
  expect((await frame.boundingBox())?.width).toBeCloseTo(375, 0);
  await expect(page.getByTestId('diagnostics')).toHaveText('No diagnostics.');
});

test('a loop reads its data from the data source', async ({ page }) => {
  await page.goto('/gallery?fixture=loop');
  await expect(page.getByRole('heading', { name: 'Second post' })).toBeVisible();
});
