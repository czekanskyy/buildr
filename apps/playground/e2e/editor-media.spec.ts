import { expect, type Page, test } from '@playwright/test';

// PB-157 / ADR-028: an external media URL is stored only after the "Zewnętrzne źródło" warning is confirmed.
const heading = 'A headline that says what you do';
const url = 'https://cdn.example.com/photo.jpg';

async function selectImage(page: Page, uiLocale: 'en' | 'pl') {
  await page.goto(`/?seed=landing&theme=light&uiLocale=${uiLocale}`);
  await expect(page.locator('.bd-canvas-host')).toHaveAttribute('data-status', 'ready');
  await expect(page.frameLocator('iframe').getByRole('heading', { name: heading })).toBeVisible();
  await page.getByRole('tab', { name: uiLocale === 'pl' ? 'Struktura' : 'Structure' }).click();
  for (let round = 0; round < 6; round++) {
    const closed = page.locator('[role="treeitem"][aria-expanded="false"]');
    if ((await closed.count()) === 0) break;
    await closed.first().locator('[data-toggle]').first().click();
  }
  await page
    .getByRole('treeitem', { name: uiLocale === 'pl' ? /Obraz/ : /Image/ })
    .first()
    .click();
}

test('an external image link asks first; Cancel stores nothing, confirming stores it', async ({
  page,
}) => {
  await selectImage(page, 'pl');
  const field = page.getByRole('textbox', { name: /Link do zewnętrznego pliku/ }).first();
  await field.fill(url);
  await page
    .getByRole('button', { name: /Dodaj link/ })
    .first()
    .click();

  const dialog = page.getByRole('alertdialog', { name: 'Zewnętrzne źródło' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('poza domeną witryny');
  await expect(dialog.getByRole('button', { name: 'Anuluj' })).toBeVisible();

  // Cancel: the dialog closes and the prop is still empty.
  await dialog.getByRole('button', { name: 'Anuluj' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.bd-media-badge')).toHaveCount(0);

  // Confirm: the link is stored and shown as external.
  await page
    .getByRole('button', { name: /Dodaj link/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Potwierdzam i dodaję link' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.bd-media-badge').first()).toHaveText('Zewnętrzny');
  await expect(page.getByText(url).first()).toBeVisible();
});

test('a link that is not https is refused without the warning', async ({ page }) => {
  await selectImage(page, 'en');
  await page
    .getByRole('textbox', { name: /Link to an external file/ })
    .first()
    .fill('http://cdn.example.com/photo.jpg');
  await page
    .getByRole('button', { name: /Add link/ })
    .first()
    .click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.getByText('Enter a full address that starts with https://')).toBeVisible();
});

test('a container background image link asks first; Cancel stores nothing, confirming stores backgroundImage', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?seed=landing&theme=light&uiLocale=pl');
  await expect(page.locator('.bd-canvas-host')).toHaveAttribute('data-status', 'ready', {
    timeout: 15_000,
  });
  await page.getByRole('tab', { name: 'Struktura', exact: true }).click();
  await page.getByRole('treeitem', { name: /Hero/ }).first().click();
  await page.getByRole('tab', { name: 'Styl', exact: true }).click();
  const section = page.locator('.bd-sec[data-group="background"]');
  const head = section.getByRole('button', { name: 'Tło' });
  await expect(head).toBeVisible();
  if ((await head.getAttribute('aria-expanded')) !== 'true') await head.click();
  const image = section.locator('[data-prop=backgroundImage]');
  await section.locator('.bd-bg-kind').getByRole('button', { name: 'Obraz', exact: true }).click();

  await image.getByRole('textbox', { name: /Link do zewnętrznego pliku/ }).fill(url);
  await image.getByRole('button', { name: /Dodaj link/ }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Zewnętrzne źródło' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Anuluj' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(image.locator('.bd-media-badge')).toHaveCount(0);

  await image.getByRole('button', { name: /Dodaj link/ }).click();
  await page.getByRole('button', { name: 'Potwierdzam i dodaję link' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(image.locator('.bd-media-badge').first()).toHaveText('Zewnętrzny');
  await expect(image.getByText(url).first()).toBeVisible();
});
