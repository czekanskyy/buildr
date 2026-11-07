import { expect, type Page } from '@playwright/test';

export const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
export const CAPTCHA_TEST_KEY = '1x00000000000000000000AA';
export const CAPTCHA_TOKEN = 'buildr.fake-turnstile-token';

export interface TurnstileCall {
  sitekey: string;
  action: string;
  cData: string;
  'response-field-name': string;
  size: string;
  theme: string;
  appearance: string;
  language: string;
}

export type StubWindow = Window &
  typeof globalThis & {
    __turnstileCalls: TurnstileCall[];
    __turnstileResets: string[];
    __turnstileExpire: () => void;
  };

// Served only by Playwright routing at the real, CSP-allowed provider origin. No network fallback.
const script = `(() => {
  const widgets = new Map();
  window.__turnstileCalls = [];
  window.__turnstileResets = [];
  window.turnstile = {
    render(container, parameters) {
      const id = String(widgets.size);
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = parameters['response-field-name'];
      input.value = '${CAPTCHA_TOKEN}';
      container.append(input);
      widgets.set(id, { input, parameters });
      window.__turnstileCalls.push(parameters);
      window.__turnstileExpire = () => parameters['expired-callback']();
      parameters.callback(input.value);
      return id;
    },
    reset(id) {
      window.__turnstileResets.push(id);
      const widget = widgets.get(id);
      if (widget) widget.input.value = '';
    },
    remove(id) {
      const widget = widgets.get(id);
      if (widget) widget.input.remove();
      widgets.delete(id);
    }
  };
})();`;

export async function stubTurnstile(page: Page) {
  const scripts: string[] = [];
  const unexpected: string[] = [];
  // Catch every outbound HTTP request, including accidental provider frames/preconnect fetches.
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === 'http://localhost:5173') return route.continue();
    if (
      url.origin === 'https://challenges.cloudflare.com' &&
      url.pathname === '/turnstile/v0/api.js'
    ) {
      scripts.push(url.href);
      return route.fulfill({ contentType: 'application/javascript', body: script });
    }
    unexpected.push(url.href);
    return route.abort();
  });
  return {
    scripts,
    unexpected,
    async assertOnlyStub(expected: number) {
      expect(scripts).toEqual(Array.from({ length: expected }, () => TURNSTILE_SCRIPT_URL));
      expect(unexpected).toEqual([]);
    },
  };
}

export async function turnstileCalls(page: Page) {
  return page.evaluate(() =>
    ((window as StubWindow).__turnstileCalls ?? []).map((parameters) => ({
      sitekey: parameters.sitekey,
      action: parameters.action,
      cData: parameters.cData,
      'response-field-name': parameters['response-field-name'],
      size: parameters.size,
      theme: parameters.theme,
      appearance: parameters.appearance,
      language: parameters.language,
    })),
  );
}
