import { expect, type Page, test } from '@playwright/test';
import {
  CAPTCHA_TEST_KEY,
  CAPTCHA_TOKEN,
  type StubWindow,
  stubTurnstile,
  TURNSTILE_SCRIPT_URL,
  turnstileCalls,
} from './turnstile-stub.ts';

const unavailable = 'The check is unavailable right now. Please try again later.';
const providerScript = 'script[data-buildr-turnstile]';
const activate = (page: Page) => page.getByRole('button', { name: 'Load the check', exact: true });

async function load(page: Page, entry = 'captcha-default', suffix = '&captchaKey=1') {
  const response = await page.goto(`/blocks?entry=${entry}${suffix}`);
  await expect(page.getByTestId('frame').locator('[data-bc-captcha]').first()).toBeVisible();
  await expect(page.getByTestId('diagnostics')).toHaveText('No diagnostics.');
  return response;
}

test('click loads one exact script and binds the token only to its reserved input', async ({
  page,
}) => {
  const network = await stubTurnstile(page);
  await load(page);
  await expect(activate(page)).toBeVisible();
  await expect(page.locator(providerScript)).toHaveCount(0);
  await expect(page.locator('input[name="buildr-captcha"]')).toHaveCount(0);
  await network.assertOnlyStub(0);
  await activate(page).click();
  await expect.poll(() => turnstileCalls(page)).toHaveLength(1);
  await expect(page.locator(providerScript)).toHaveCount(1);
  await expect(page.locator(providerScript)).toHaveAttribute('src', TURNSTILE_SCRIPT_URL);
  expect(await turnstileCalls(page)).toEqual([
    {
      sitekey: CAPTCHA_TEST_KEY,
      action: 'buildr_form',
      cData: expect.stringMatching(/^[a-f0-9]{64}$/),
      'response-field-name': 'buildr-captcha',
      size: 'normal',
      theme: 'auto',
      appearance: 'always',
      language: 'en',
    },
  ]);
  const token = page.locator('input[name="buildr-captcha"]');
  await expect(token).toHaveAttribute('type', 'hidden');
  await expect(token).toHaveValue(CAPTCHA_TOKEN);
  expect(
    await page
      .locator('form')
      .evaluate((form) =>
        [...new FormData(form as HTMLFormElement)].filter(([, value]) =>
          String(value).includes('buildr.fake-turnstile-token'),
        ),
      ),
  ).toEqual([['buildr-captcha', CAPTCHA_TOKEN]]);
  expect(await page.getByTestId('frame').innerText()).not.toContain(CAPTCHA_TOKEN);
  await network.assertOnlyStub(1);
});

test('canvas never receives the key or loads the provider', async ({ page }) => {
  const network = await stubTurnstile(page);
  await load(page, 'captcha-default', '&captchaKey=1&mode=canvas');
  await expect(activate(page)).toHaveCount(0);
  await expect(page.locator(providerScript)).toHaveCount(0);
  expect(await page.getByTestId('frame').innerHTML()).not.toContain(CAPTCHA_TEST_KEY);
  await network.assertOnlyStub(0);
});

for (const entry of ['captcha-default', 'captcha-no-site-key', 'captcha-invalid-site-key']) {
  test(`${entry}: missing or invalid key fails closed without a script`, async ({ page }) => {
    const network = await stubTurnstile(page);
    await load(page, entry, entry === 'captcha-default' ? '' : '&captchaKey=1');
    await expect(page.locator('[data-bc-captcha]')).toHaveText(unavailable);
    await expect(activate(page)).toHaveCount(0);
    await expect(page.locator(providerScript)).toHaveCount(0);
    await network.assertOnlyStub(0);
  });
}

test('Tab and Enter activate the native consent button', async ({ page }) => {
  const network = await stubTurnstile(page);
  await load(page);
  await page.getByTestId('frame').evaluate((element) => {
    element.tabIndex = -1;
    element.focus();
  });
  await page.keyboard.press('Tab');
  await expect(activate(page)).toBeFocused();
  await network.assertOnlyStub(0);
  await page.keyboard.press('Enter');
  await expect.poll(() => turnstileCalls(page)).toHaveLength(1);
  await expect(page.locator('.bc-captcha__enhancer [role="status"]')).toBeFocused();
  await network.assertOnlyStub(1);
});

test('submission captures the token then resets the widget and clears stale expiry on success', async ({
  page,
}) => {
  const network = await stubTurnstile(page);
  const submissions: string[] = [];
  await page.route('**/forms/**', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    submissions.push(route.request().postData() ?? '');
    return route.fulfill({ json: { ok: true } });
  });
  await load(page);
  await activate(page).click();
  await expect.poll(() => turnstileCalls(page)).toHaveLength(1);
  // A previous expiry message must not survive the next successful submission.
  await page.evaluate(() => (window as StubWindow).__turnstileExpire());
  await expect(page.locator('.bc-captcha__enhancer [role="status"]')).toContainText(/expired/i);
  await page.locator('input[name="buildr-captcha"]').evaluate((input) => {
    (input as HTMLInputElement).value = 'buildr.fake-turnstile-token';
  });
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('.bc-form__status')).toContainText(/thank|sent/i);
  await expect(page.locator('.bc-captcha__enhancer [role="status"]')).toHaveText('');
  await expect
    .poll(() => page.evaluate(() => (window as StubWindow).__turnstileResets))
    .toEqual(['0', '0']);
  expect(submissions).toHaveLength(1);
  expect(submissions[0]).toContain('name="buildr-captcha"');
  expect(submissions[0]).toContain(CAPTCHA_TOKEN);
  await expect(page.locator('input[name="buildr-captcha"]')).toHaveValue('');
  await network.assertOnlyStub(1);
});

test('sequential clicks across three forms reuse one script and have distinct form bindings', async ({
  page,
}) => {
  const network = await stubTurnstile(page);
  await load(page, 'captcha-multiple');
  await expect(page.locator('form')).toHaveCount(3);
  for (let count = 1; count <= 3; count++) {
    await activate(page).first().click();
    await expect.poll(() => turnstileCalls(page)).toHaveLength(count);
  }
  const calls = await turnstileCalls(page);
  expect(new Set(calls.map((call) => call.cData)).size).toBe(3);
  await expect(page.locator('form input[name="buildr-captcha"]')).toHaveCount(3);
  await expect(page.locator(providerScript)).toHaveCount(1);
  await network.assertOnlyStub(1);
});

test('preview requires consent even when the host disables click-to-load', async ({ page }) => {
  const network = await stubTurnstile(page);
  await load(page, 'captcha-auto', '&captchaKey=1&mode=preview');
  await expect(activate(page)).toBeVisible();
  await expect(page.locator(providerScript)).toHaveCount(0);
  await network.assertOnlyStub(0);
  await activate(page).click();
  await expect.poll(() => turnstileCalls(page)).toHaveLength(1);
  await network.assertOnlyStub(1);
});

for (const carrier of ['script', 'meta', 'missing']) {
  test(`enforcing CSP with ${carrier} nonce carrier`, async ({ page }) => {
    const network = await stubTurnstile(page);
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (event) => {
        // React's development diagnostics can probe eval; record provider violations only.
        if (event.blockedURI.startsWith('https://challenges.cloudflare.com')) {
          document.documentElement.setAttribute('data-csp-blocked', event.blockedURI);
        }
      });
    });
    const response = await load(page, 'captcha-default', `&captchaKey=1&captchaCsp=${carrier}`);
    const csp = response?.headers()['content-security-policy'];
    expect(csp).toContain("'nonce-");
    expect(csp).toContain('https://challenges.cloudflare.com');
    expect(response?.headers()['content-security-policy-report-only']).toBeUndefined();
    await activate(page).click();
    if (carrier === 'missing') {
      await expect(page.locator('[data-bc-captcha]')).toContainText(unavailable);
      await expect(page.locator('html')).toHaveAttribute('data-csp-blocked', TURNSTILE_SCRIPT_URL);
      expect(await turnstileCalls(page)).toEqual([]);
      await network.assertOnlyStub(0);
    } else {
      await expect.poll(() => turnstileCalls(page)).toHaveLength(1);
      const nonce = await page
        .locator(providerScript)
        .evaluate((script) => (script as HTMLScriptElement).nonce);
      expect(nonce).not.toBe('');
      expect(csp).toContain(`'nonce-${nonce}'`);
      await expect(page.locator('html')).not.toHaveAttribute('data-csp-blocked');
      await network.assertOnlyStub(1);
    }
  });
}

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('server HTML has no widget or provider request', async ({ page }) => {
    const network = await stubTurnstile(page);
    const response = await load(page, 'captcha-default', '&captchaKey=1&static=1');
    const html = await response?.text();
    expect(html).not.toContain(TURNSTILE_SCRIPT_URL);
    expect(html).not.toContain(CAPTCHA_TEST_KEY);
    await expect(page.locator('.bc-captcha__widget')).toBeEmpty();
    await expect(activate(page)).toHaveCount(0);
    await expect(page.locator('.bc-captcha__button')).toBeHidden();
    await expect(page.locator('input[name="buildr-captcha"]')).toHaveCount(0);
    await expect(page.locator(providerScript)).toHaveCount(0);
    await network.assertOnlyStub(0);
  });
});
