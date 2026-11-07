// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TURNSTILE_SCRIPT_URL } from './constants.ts';
import { CaptchaCanvasHint, CaptchaEnhancer } from './enhancer.client.tsx';
import type { TurnstileParameters } from './turnstile.ts';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const texts = {
  notice: 'Notice',
  button: 'Load',
  loading: 'Loading',
  ready: 'Ready',
  expired: 'Expired',
  error: 'Error',
  unavailable: 'Unavailable',
};
const props = { siteKey: 'SITE_KEY', layoutRef: 'pages:7', locale: 'pl', clickToLoad: true, texts };
const roots: { unmount(): void }[] = [];
const parameters: TurnstileParameters[] = [];
const digest = vi.fn(
  async (_algorithm: string, _bytes: Uint8Array) =>
    Uint8Array.from(
      'c47c8c8af9e80b051f3b04cb4d4b21fc9d9629b14d524573365fa5b717a50ce5'.match(/../g) ?? [],
      (byte) => Number.parseInt(byte, 16),
    ).buffer,
);
const provider = {
  render: vi.fn((child: HTMLElement, options: TurnstileParameters) => {
    parameters.push(options);
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = options['response-field-name'];
    input.value = 'token-secret';
    child.append(input);
    return `widget-${parameters.length}`;
  }),
  reset: vi.fn(),
  remove: vi.fn(),
};
beforeEach(() => {
  vi.clearAllMocks();
  parameters.length = 0;
  vi.stubGlobal('crypto', {
    subtle: {
      digest,
    },
  });
});
afterEach(async () => {
  await act(async () => {
    for (const root of roots.splice(0)) root.unmount();
  });
  document.body.replaceChildren();
  document.head.replaceChildren();
  vi.unstubAllGlobals();
});
function mount(overrides = {}, id = 'form1') {
  const form = document.createElement('form');
  form.setAttribute('data-buildr-form', id);
  const wrapper = document.createElement('div');
  wrapper.className = 'bc-loop';
  wrapper.setAttribute('data-buildr-form', 'forged-wrapper-id');
  const host = document.createElement('div');
  form.append(wrapper);
  wrapper.append(host);
  document.body.append(form);
  const root = createRoot(host);
  roots.push(root);
  act(() => root.render(<CaptchaEnhancer {...props} {...overrides} />));
  return {
    form,
    host,
    root,
    button: () => host.querySelector('button') as HTMLButtonElement,
    status: () => host.querySelector('[role="status"]')?.textContent,
  };
}
async function click(widget: ReturnType<typeof mount>) {
  await act(async () => widget.button().click());
}
function script() {
  return document.querySelector<HTMLScriptElement>('script[data-buildr-turnstile]');
}
async function load() {
  vi.stubGlobal('turnstile', provider);
  await act(async () => script()?.dispatchEvent(new Event('load')));
}

it('hydrates hidden consent without warnings, and waits for its script load before calling the API', async () => {
  const form = document.createElement('form');
  form.setAttribute('data-buildr-form', 'form1');
  const host = document.createElement('div');
  form.append(host);
  document.body.append(form);
  host.innerHTML = renderToString(<CaptchaEnhancer {...props} />);
  expect(host.querySelector('button')?.hidden).toBe(true);
  expect(script()).toBeNull();
  const errors = vi.spyOn(console, 'error');
  try {
    await act(async () => {
      roots.push(hydrateRoot(host, <CaptchaEnhancer {...props} />));
    });
    expect(host.querySelector('button')?.hidden).toBe(false);
    vi.stubGlobal('turnstile', provider);
    await act(async () => host.querySelector('button')?.click());
    expect(script()?.src).toBe(TURNSTILE_SCRIPT_URL);
    expect(script()?.async).toBe(true);
    expect(script()?.getAttribute('data-buildr-turnstile')).toBe('loading');
    expect(provider.render).not.toHaveBeenCalled();
    await load();
    expect(script()?.getAttribute('data-buildr-turnstile')).toBe('ready');
    expect(provider.render).toHaveBeenCalledTimes(1);
    expect(errors).not.toHaveBeenCalled();
  } finally {
    errors.mockRestore();
  }
});
it('shares one loading script across widgets, sequential clicks and remounts', async () => {
  const first = mount();
  const second = mount({}, 'other');
  await click(first);
  await click(second);
  const tag = script();
  expect(document.querySelectorAll('script[data-buildr-turnstile]')).toHaveLength(1);
  await load();
  expect(provider.render).toHaveBeenCalledTimes(2);
  const third = mount();
  await click(third);
  expect(provider.render).toHaveBeenCalledTimes(3);
  expect(script()).toBe(tag);
  await act(async () => first.root.unmount());
  roots.splice(roots.indexOf(first.root), 1);
  expect(provider.remove).toHaveBeenCalledWith('widget-1');
  const fourth = mount();
  await click(fourth);
  expect(provider.render).toHaveBeenCalledTimes(4);
  expect(script()).toBe(tag);
});
it('pins every render parameter, closest form binding, and keeps the token only in the provider input', async () => {
  const widget = mount();
  await click(widget);
  await load();
  expect(digest.mock.calls[0]?.[0]).toBe('SHA-256');
  expect(new TextDecoder().decode(digest.mock.calls[0]?.[1])).toBe(
    JSON.stringify(['buildr/captcha', 1, 'pages:7', 'form1']),
  );
  expect(parameters[0]).toEqual({
    sitekey: 'SITE_KEY',
    action: 'buildr_form',
    cData: 'c47c8c8af9e80b051f3b04cb4d4b21fc9d9629b14d524573365fa5b717a50ce5',
    'response-field-name': 'buildr-captcha',
    size: 'normal',
    theme: 'auto',
    appearance: 'always',
    language: 'pl',
    callback: expect.any(Function),
    'expired-callback': expect.any(Function),
    'error-callback': expect.any(Function),
    'timeout-callback': expect.any(Function),
  });
  const options = parameters[0];
  if (!options) throw Error('missing parameters');
  await act(async () => options.callback());
  expect(widget.status()).toBe('Ready');
  for (const element of document.querySelectorAll('*'))
    for (const attribute of element.attributes)
      if (
        !(
          element instanceof HTMLInputElement &&
          element.name === 'buildr-captcha' &&
          attribute.name === 'value'
        )
      )
        expect(attribute.value).not.toContain('token-secret');
  const input = widget.form.querySelector('input');
  expect(input?.name).toBe('buildr-captcha');
  expect(input?.type).toBe('hidden');
  expect(input?.value).toBe('token-secret');
  expect(new FormData(widget.form).get('buildr-captcha')).toBe('token-secret');
  expect(widget.host.textContent).not.toContain('token-secret');
  for (const [name, text] of [
    ['expired-callback', 'Expired'],
    ['error-callback', 'Error'],
    ['timeout-callback', 'Expired'],
  ] as const) {
    await act(async () => options[name]());
    expect(widget.status()).toBe(text);
  }
  expect(provider.reset).toHaveBeenCalledTimes(3);
  for (const [detail, text] of [
    [{ status: 200 }, ''],
    [{ status: 422, codes: { email: 'required' } }, ''],
    [{ status: 0 }, 'Error'],
    [{ status: 503 }, ''],
    [{ status: 422, codes: { 'buildr-captcha': 'captcha' } }, 'Error'],
    [{ status: 503, code: 'captcha-unavailable' }, 'Unavailable'],
  ] as const) {
    await act(async () =>
      widget.form.dispatchEvent(new CustomEvent('buildr-form:settled', { bubbles: true, detail })),
    );
    expect(widget.status()).toBe(text);
  }
  expect(provider.reset).toHaveBeenCalledTimes(9);
});
it('loads at mount only after consent was explicitly opted out', async () => {
  const widget = mount({ clickToLoad: false, locale: 'bad_locale' });
  await act(async () => {});
  expect(script()).not.toBeNull();
  await load();
  expect(parameters[0]?.language).toBe('auto');
  expect(widget.button().hidden).toBe(true);
});
it.each(['error', 'clobbered'] as const)('allows retry after %s', async (failure) => {
  const widget = mount();
  await click(widget);
  const failed = script();
  if (failure === 'clobbered') vi.stubGlobal('turnstile', document.createElement('div'));
  await act(async () => failed?.dispatchEvent(new Event(failure === 'error' ? 'error' : 'load')));
  expect(provider.render).not.toHaveBeenCalled();
  expect(widget.status()).toBe('Unavailable');
  expect(failed?.getAttribute('data-buildr-turnstile')).toBe('failed');
  await click(widget);
  expect(script()).not.toBe(failed);
  expect(document.querySelectorAll('script[data-buildr-turnstile]')).toHaveLength(1);
  await load();
  expect(provider.render).toHaveBeenCalledTimes(1);
});
it('cancels consumer listeners on unmount during load, while preserving script state for remount', async () => {
  const widget = mount();
  await click(widget);
  const tag = script();
  if (!tag) throw Error('no script');
  const remove = vi.spyOn(tag, 'removeEventListener');
  await act(async () => widget.root.unmount());
  roots.splice(roots.indexOf(widget.root), 1);
  expect(remove.mock.calls.map(([name]) => name)).toEqual(
    expect.arrayContaining(['load', 'error']),
  );
  await load();
  expect(provider.render).not.toHaveBeenCalled();
  expect(tag.getAttribute('data-buildr-turnstile')).toBe('ready');
  const next = mount();
  await click(next);
  expect(provider.render).toHaveBeenCalledTimes(1);
});
it.each([
  ['<script nonce="script-value"></script>', 'script-value'],
  ['<script nonce=""></script><script nonce="second"></script>', 'second'],
  ['<script nonce=""></script><meta name="csp-nonce" content="meta-value">', 'meta-value'],
  [
    '<script nonce="script-value"></script><meta name="csp-nonce" content="meta-value">',
    'script-value',
  ],
  ['', ''],
])('copies the first non-empty nonce: %s', async (carriers, expected) => {
  document.head.innerHTML = carriers;
  const widget = mount();
  await click(widget);
  expect(script()?.nonce).toBe(expected);
});
it.each(['crypto', 'layout', 'form'] as const)('fails closed without %s', async (missing) => {
  if (missing === 'crypto') vi.stubGlobal('crypto', {});
  const widget = mount(
    { layoutRef: missing === 'layout' ? '' : 'pages:7' },
    missing === 'form' ? '' : 'form1',
  );
  await click(widget);
  expect(script()).toBeNull();
  expect(widget.status()).toBe('Unavailable');
});

it('shows a canvas duplicate hint only for captchas belonging to the nearest form', async () => {
  const form = document.createElement('form');
  const host = document.createElement('div');
  host.setAttribute('data-bc-captcha', '');
  form.append(host);
  document.body.append(form);
  const root = createRoot(host);
  roots.push(root);
  await act(async () => root.render(<CaptchaCanvasHint text="Canvas" duplicate="Duplicate" />));
  expect(host.textContent).toBe('Canvas');
  const nested = document.createElement('form');
  const inner = document.createElement('div');
  inner.setAttribute('data-bc-captcha', '');
  nested.append(inner);
  await act(async () => form.append(nested));
  expect(host.textContent).toBe('Canvas');
  const sibling = document.createElement('div');
  sibling.setAttribute('data-bc-captcha', '');
  await act(async () => form.append(sibling));
  expect(host.textContent).toBe('Duplicate');
  expect(script()).toBeNull();
});

it('keeps a solved widget across equal props rerenders and preserves click focus', async () => {
  const widget = mount();
  expect(document.activeElement).not.toBe(widget.host.querySelector('[role="status"]'));
  widget.button().focus();
  await click(widget);
  expect(document.activeElement).toBe(widget.host.querySelector('[role="status"]'));
  await load();
  await act(async () => parameters[0]?.callback());
  const input = widget.form.querySelector('input');
  await act(async () => widget.root.render(<CaptchaEnhancer {...props} texts={{ ...texts }} />));
  expect(provider.render).toHaveBeenCalledTimes(1);
  expect(provider.remove).not.toHaveBeenCalled();
  expect(widget.form.querySelector('input')).toBe(input);
  expect(new FormData(widget.form).get('buildr-captcha')).toBe('token-secret');
});

it.each([
  undefined,
  () => {
    throw Error('damaged');
  },
])('removes owned DOM with damaged remove: %s', async (remove) => {
  const widget = mount();
  await click(widget);
  vi.stubGlobal('turnstile', { ...provider, remove });
  await act(async () => script()?.dispatchEvent(new Event('load')));
  const child = widget.host.querySelector('.bc-captcha__widget')?.firstElementChild;
  await act(async () => widget.root.render(<span />));
  expect(child?.isConnected).toBe(false);
});
