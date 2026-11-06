import { expect, test } from '@playwright/test';

// The editor pings the canvas every 5 s and calls the connection lost when no `pong` comes back
// within 15 s. An idle editor must outlive that window: this once showed the "connection lost"
// card about 15-20 s after load because the canvas's `pong` never reached the editor.
test('an idle editor keeps its canvas connection past the heartbeat timeout', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/?seed=landing&uiLocale=en');
  const host = page.locator('.bd-canvas-host');
  await expect(host).toHaveAttribute('data-status', 'ready', { timeout: 15_000 });

  const lost = page.locator('.bd-canvas-error');
  // Past the 15 s pong timeout plus two further pings; the card would be up well before the end.
  for (let second = 0; second < 22; second += 1) {
    await page.waitForTimeout(1000);
    await expect(lost).toHaveCount(0);
  }
  await expect(host).toHaveAttribute('data-status', 'ready');
});
