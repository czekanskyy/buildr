import { expect, type Locator, type Page, test } from '@playwright/test';

const trackOf = (page: Page) => page.getByTestId('frame').locator('.bc-carousel__track');
const dot = (page: Page, n: number) =>
  page.getByRole('button', { name: `Go to slide ${n}`, exact: true });
async function position(track: Locator, index: number) {
  await expect
    .poll(() =>
      track.evaluate((el) => {
        const slides = el.querySelectorAll('.bc-carousel-slide');
        return Math.round(el.scrollLeft / (slides[0]?.getBoundingClientRect().width || 1));
      }),
    )
    .toBe(index);
  await expect
    .poll(() =>
      track.evaluate((el, n) => {
        const slide = el.querySelectorAll('.bc-carousel-slide')[n];
        return Math.abs(
          (slide?.getBoundingClientRect().left ?? Infinity) - el.getBoundingClientRect().left,
        );
      }, index),
    )
    .toBeLessThan(2);
}
async function load(page: Page, entry: string, suffix = '') {
  await page.goto(`/blocks?entry=${entry}&w=768${suffix}`);
  await expect(
    page.getByTestId('frame').locator('.bc-carousel, .bc-gallery').first(),
  ).toBeVisible();
  await expect(page.getByTestId('diagnostics')).toHaveText('No diagnostics.');
}

test('carousel controls, dots, geometry, inert slides and keyboard navigation', async ({
  page,
}) => {
  await load(page, 'carousel-default');
  const track = trackOf(page);
  const slides = track.locator('.bc-carousel-slide');
  await expect(page.getByRole('button', { name: 'Next slide', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Previous slide', exact: true })).toBeVisible();
  await expect(slides.nth(0)).toBeVisible();
  await expect(slides.nth(0)).not.toHaveAttribute('inert');
  await expect(slides.nth(2)).toHaveAttribute('inert', '');
  await page.getByRole('button', { name: 'Next slide', exact: true }).click();
  await position(track, 1);
  await expect(dot(page, 2)).toHaveAttribute('aria-current', 'true');
  await expect(slides.nth(0)).toHaveAttribute('inert', '');
  await expect(slides.nth(1)).toBeVisible();
  await expect(slides.nth(1)).not.toHaveAttribute('inert');
  await page.getByRole('button', { name: 'Previous slide', exact: true }).click();
  await position(track, 0);
  await dot(page, 3).click();
  await position(track, 2);
  await expect(dot(page, 3)).toHaveAttribute('aria-current', 'true');
  await track.focus();
  await page.keyboard.press('ArrowLeft');
  await position(track, 1);
  await page.keyboard.press('ArrowRight');
  await position(track, 2);
  await expect(dot(page, 3)).toHaveAttribute('aria-current', 'true');
});

test('arrow keys in a slide input do not navigate', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await load(page, 'carousel-input');
  const input = page.getByTestId('frame').getByRole('textbox');
  await input.fill('abc');
  await input.press('ArrowLeft');
  await expect.poll(() => input.evaluate((el: HTMLInputElement) => el.selectionStart)).toBe(2);
  await input.press('ArrowRight');
  await expect.poll(() => input.evaluate((el: HTMLInputElement) => el.selectionStart)).toBe(3);
  await position(trackOf(page), 0);
  await expect(dot(page, 1)).toHaveAttribute('aria-current', 'true');
});

test('autoplay advances and wraps, hover pauses, pointer Pause remains sticky after leaving', async ({
  page,
}) => {
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await load(page, 'carousel-autoplay');
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.mouse.move(0, 0);
  await expect(trackOf(page)).toHaveAttribute('aria-live', 'off');
  await page.clock.runFor(3600);
  await position(trackOf(page), 1);
  await page.clock.runFor(3600);
  await position(trackOf(page), 2);
  await page.clock.runFor(3600);
  await position(trackOf(page), 0);
  await trackOf(page).hover();
  await expect(trackOf(page)).toHaveAttribute('aria-live', 'polite');
  await page.clock.runFor(3600);
  await position(trackOf(page), 0);
  await page.getByRole('button', { name: 'Pause automatic rotation' }).click();
  await page.mouse.move(0, 0);
  await expect(page.getByRole('button', { name: 'Start automatic rotation' })).toBeVisible();
  await page.clock.runFor(7000);
  await position(trackOf(page), 0);
});

test('keyboard entry stops rotation; Play and subsequent Tab navigation keep it running', async ({
  page,
}) => {
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await load(page, 'carousel-autoplay');
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.mouse.move(0, 0);
  // Enter from outside using real Tab, rather than programmatic focus inside the carousel.
  await page.getByTestId('frame').evaluate((frame) => {
    frame.tabIndex = -1;
    frame.focus();
  });
  await page.keyboard.press('Tab');
  const play = page.getByRole('button', { name: 'Start automatic rotation' });
  await expect(play).toBeFocused();
  await page.clock.runFor(3600);
  await position(trackOf(page), 0);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Next slide', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dot(page, 1)).toBeFocused();
  await expect(trackOf(page)).toHaveAttribute('aria-live', 'off');
  await page.clock.runFor(3600);
  await position(trackOf(page), 1);
});

test('reduced motion prevents autoplay and exposes disabled Play', async ({ page }) => {
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await load(page, 'carousel-autoplay');
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await expect(page.getByRole('button', { name: 'Start automatic rotation' })).toBeDisabled();
  await page.clock.runFor(7000);
  await position(trackOf(page), 0);
  await expect(dot(page, 1)).toHaveAttribute('aria-current', 'true');
});

test('gallery modal image, caption, counter, navigation and focus return', async ({ page }) => {
  await load(page, 'gallery-four');
  const links = page.getByTestId('frame').locator('.bc-gallery-item__link');
  const opener = links.nth(1);
  await expect
    .poll(() =>
      links
        .first()
        .locator('img')
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  const href = await opener.getAttribute('href');
  await opener.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((el) => el.matches(':modal'))).toBe(true);
  await expect(dialog.locator('img')).toHaveAttribute('src', new URL(href ?? '', page.url()).href);
  await expect
    .poll(() => dialog.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
  await expect(dialog).toContainText('Landscape 2');
  await expect(dialog).toContainText('Image 2 of 4');
  await dialog.getByRole('button', { name: 'Next image' }).click();
  await expect(dialog).toContainText('Image 3 of 4');
  await dialog.getByRole('button', { name: 'Previous image' }).click();
  await expect(dialog).toContainText('Image 2 of 4');
  await page.keyboard.press('ArrowRight');
  await expect(dialog).toContainText('Landscape 3');
  await page.keyboard.press('ArrowLeft');
  await expect(dialog).toContainText('Landscape 2');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
  await opener.click();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
});

test('modifier clicks preserve link behavior and lightbox false navigates to the image', async ({
  page,
  context,
}) => {
  await load(page, 'gallery-default');
  const popupPromise = context.waitForEvent('page');
  await page
    .getByTestId('frame')
    .locator('.bc-gallery-item__link')
    .first()
    .click({ modifiers: ['Control'] });
  const popup = await popupPromise;
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await popup.close();
  await load(page, 'gallery-links');
  const link = page.getByTestId('frame').locator('.bc-gallery-item__link').first();
  const href = await link.getAttribute('href');
  await expect(page.locator('dialog')).toHaveCount(0);
  await link.click();
  await expect(page).toHaveURL(new RegExp(`${href?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
});

test('two galleries own independent dialogs', async ({ page }) => {
  await load(page, 'gallery-two');
  const galleries = page.getByTestId('frame').locator('.bc-gallery');
  await expect(galleries).toHaveCount(2);
  await galleries.nth(0).locator('.bc-gallery-item__link').first().click();
  await expect(galleries.nth(0).locator('dialog')).toBeVisible();
  await expect(galleries.nth(1).locator('dialog')).not.toBeVisible();
  await page.keyboard.press('Escape');
  await galleries.nth(1).locator('.bc-gallery-item__link').last().click();
  await expect(galleries.nth(1).locator('dialog')).toBeVisible();
  await expect(galleries.nth(0).locator('dialog')).not.toBeVisible();
});

test('static carousel snaps natively without a control bar', async ({ page }) => {
  await load(page, 'carousel-default', '&static=1');
  const track = trackOf(page);
  await expect(track).toBeVisible();
  await expect(track).not.toHaveAttribute('aria-live');
  await expect(track.locator('[inert]')).toHaveCount(0);
  await expect(page.locator('.bc-carousel__controls:visible')).toHaveCount(0);
  await track.evaluate((el) => {
    const width = el.querySelector('.bc-carousel-slide')?.getBoundingClientRect().width ?? 0;
    el.scrollBy({ left: width * 0.8, behavior: 'instant' });
  });
  await position(track, 1);
});

test('static gallery exposes plain image links without a dialog', async ({ page }) => {
  await load(page, 'gallery-default', '&static=1');
  const links = page.getByTestId('frame').locator('.bc-gallery-item__link');
  await expect(links).toHaveCount(3);
  for (const link of await links.all()) {
    expect(await link.getAttribute('href')).toBe(await link.locator('img').getAttribute('src'));
  }
  await expect(page.locator('dialog')).toHaveCount(0);
});
