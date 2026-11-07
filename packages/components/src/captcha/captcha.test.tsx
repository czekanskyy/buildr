// @vitest-environment jsdom
import type { BuilderComponentProps } from '@next-buildr/react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { Button } from '../button/definition.ts';
import { Form } from '../form/definition.ts';
import { BUILT_IN_MESSAGES } from '../messages/index.ts';
import { Page } from '../page/definition.ts';
import { createRegistry, pageWith, problemsOf, render } from '../test-kit.tsx';
import { Captcha } from './definition.ts';
import { captchaFixtures } from './fixtures.ts';
import type { captchaProps } from './props.ts';
import { CaptchaView } from './view.tsx';

const key = 'public_site-key';
function input(
  captcha: unknown = { provider: 'turnstile', siteKey: key },
  mode = 'production',
  locale = 'en',
) {
  return {
    props: {},
    root: { className: 'bc-captcha b-x', id: 'captcha-root', 'data-test': 'root' },
    node: { id: 'captcha', type: 'buildr/captcha' },
    slots: {},
    env: { mode, locale, messages: {}, layoutRef: 'pages:7' },
    platform: { captcha },
  } as unknown as BuilderComponentProps<typeof captchaProps>;
}
function view(captcha?: unknown, mode?: string, locale?: string) {
  return renderToStaticMarkup(createElement(CaptchaView, input(captcha, mode, locale)));
}

it.each(['production', 'preview', 'canvas'])('never injects a script during %s SSR', (mode) => {
  const before = document.querySelectorAll('script').length;
  const html = view({ provider: 'turnstile', siteKey: key, clickToLoad: false }, mode);
  expect(html).not.toContain('<script');
  expect(html).not.toContain('api.js');
  expect(html).not.toContain(key);
  expect(document.querySelectorAll('script')).toHaveLength(before);
  expect(html).toContain('id="captcha-root" data-test="root" data-bc-captcha=""');
});

it('requires the click by default, hides the button until mount and supplies no-JS text', () => {
  const host = document.createElement('div');
  host.innerHTML = view();
  expect(host.querySelector('button')?.hidden).toBe(true);
  expect(host.querySelector('button')?.type).toBe('button');
  expect(host.querySelector('button')?.getAttribute('aria-describedby')).toBe(
    host.querySelector('p')?.id,
  );
  expect(host.querySelector('[role="status"]')?.getAttribute('aria-live')).toBe('polite');
  expect(host.querySelector('noscript')?.textContent).toBe(
    BUILT_IN_MESSAGES.en['captcha.noscript'],
  );
  expect(host.textContent).toContain('challenges.cloudflare.com');
  expect(host.textContent).toContain('cookies');
});

it.each([undefined, true, 'false', 0, null])(
  'only literal false opts out of the click: %s',
  (clickToLoad) => {
    const element = CaptchaView(input({ provider: 'turnstile', siteKey: key, clickToLoad }));
    expect(element.props.children[0].props.clickToLoad).toBe(true);
  },
);

it('allows opt-out in production but forces the click in preview', () => {
  for (const mode of ['production', 'preview']) {
    const element = CaptchaView(
      input({ provider: 'turnstile', siteKey: key, clickToLoad: false }, mode),
    );
    expect(element.props.children[0].props.clickToLoad).toBe(mode === 'preview');
    expect(element.props.children[0].props.layoutRef).toBe('pages:7');
  }
});

it.each([
  null,
  {},
  { provider: 'other', siteKey: key },
  ...['', 'a b', 'a'.repeat(129), 'ż', '<script>', 'x\n'].map((siteKey) => ({
    provider: 'turnstile',
    siteKey,
  })),
])('reports unavailable for invalid config %j', (config) => {
  const html = view(config);
  expect(html).toContain(BUILT_IN_MESSAGES.en['captcha.unavailable']);
  expect(html).not.toContain('<button');
  expect(html).not.toContain('<script');
});

it('never reads the provider getter in the canvas and uses the exact localized canvas copy', () => {
  for (const locale of ['en', 'pl'] as const) {
    const props = input(undefined, 'canvas', locale);
    Object.defineProperty(props.platform, 'captcha', {
      get() {
        throw Error('canvas config read');
      },
    });
    const html = renderToStaticMarkup(createElement(CaptchaView, props));
    expect(html).toContain(BUILT_IN_MESSAGES[locale]['captcha.canvas']);
    for (const forbidden of ['<button', '<script', '<iframe', 'key=', 'challenges.cloudflare.com'])
      expect(html).not.toContain(forbidden);
  }
});

it('keeps the leaf metadata small, serializable and limited to form placement and spacing', () => {
  expect(Captcha.meta.type).toBe('buildr/captcha');
  expect(Captcha.meta.version).toBe(1);
  expect(Captcha.meta.props).toEqual({});
  expect(Captcha.meta.slots).toBeUndefined();
  expect(Captcha.meta.parents).toEqual({ requireAncestor: ['buildr/form'], deny: ['buildr/loop'] });
  expect(Captcha.meta.styles?.groups).toEqual(['spacing']);
  expect(JSON.parse(JSON.stringify(Captcha.meta))).toEqual(Captcha.meta);
  expect(new TextEncoder().encode(JSON.stringify(Captcha.meta)).length).toBeLessThan(500);
});

it('has valid fixtures ready for P4 registration', async () => {
  const registry = createRegistry({ components: [Page, Form, Button, Captcha] });
  for (const fixture of captchaFixtures) {
    expect(problemsOf(registry, fixture)).toEqual([]);
    const result = await render(registry, pageWith(fixture.tree));
    expect(result.diagnostics).toEqual([]);
    expect(result.html).toContain('data-bc-captcha');
  }
});

it('has parity for every captcha message in English and Polish', () => {
  const keys = Object.keys(BUILT_IN_MESSAGES.en).filter((key) => key.startsWith('captcha.'));
  expect(keys).toHaveLength(10);
  expect(
    Object.keys(BUILT_IN_MESSAGES.pl)
      .filter((key) => key.startsWith('captcha.'))
      .sort(),
  ).toEqual(keys.sort());
});

it('passes axe for all server states', async () => {
  for (const html of [view(), view(null), view(undefined, 'canvas'), view(undefined, 'preview')]) {
    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.replaceChildren(host);
    expect(
      (
        await axe(host, {
          rules: { region: { enabled: false }, 'color-contrast': { enabled: false } },
        })
      ).violations,
    ).toEqual([]);
  }
});

it('has a stable unavailable SSR snapshot', () => {
  expect(view(null)).toMatchInlineSnapshot(
    `"<div class="bc-captcha b-x" id="captcha-root" data-test="root" data-bc-captcha="">The check is unavailable right now. Please try again later.</div>"`,
  );
});
