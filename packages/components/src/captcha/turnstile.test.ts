// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { TURNSTILE_SCRIPT_URL } from './constants.ts';
import { loadTurnstile } from './turnstile.ts';

const fakeApi = () => ({ render: vi.fn(() => 'widget'), reset: vi.fn(), remove: vi.fn() });
const scripts = () => document.querySelectorAll<HTMLScriptElement>('script[data-buildr-turnstile]');
const tag = () => scripts()[0] as HTMLScriptElement;
const load = () => loadTurnstile(new AbortController().signal);

afterEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it('shares one exact script across concurrent consumers and waits for its own load event', async () => {
  const api = fakeApi();
  vi.stubGlobal('turnstile', api);
  const first = load();
  const second = load();
  const done = vi.fn();
  void first.then(done);
  expect(scripts()).toHaveLength(1);
  expect(tag().getAttribute('src')).toBe(TURNSTILE_SCRIPT_URL);
  expect(tag().async).toBe(true);
  expect(tag().getAttribute('data-buildr-turnstile')).toBe('loading');
  window.dispatchEvent(new Event('load'));
  await Promise.resolve();
  expect(done).not.toHaveBeenCalled();
  tag().dispatchEvent(new Event('load'));
  expect(await first).toBe(api);
  expect(await second).toBe(api);
  expect(tag().getAttribute('data-buildr-turnstile')).toBe('ready');
  expect(await load()).toBe(api);
  expect(scripts()).toHaveLength(1);
});

it('retries a failed load with one replacement script', async () => {
  const first = load();
  const failure = expect(first).rejects.toThrow();
  const old = tag();
  old.dispatchEvent(new Event('error'));
  await failure;
  expect(old.getAttribute('data-buildr-turnstile')).toBe('failed');
  const second = load();
  expect(tag()).not.toBe(old);
  expect(scripts()).toHaveLength(1);
  vi.stubGlobal('turnstile', fakeApi());
  tag().dispatchEvent(new Event('load'));
  await second;
  expect(tag().getAttribute('data-buildr-turnstile')).toBe('ready');
});

it.each([undefined, {}, { render: true }, document.createElement('div')])(
  'ignores a clobbered or missing render API: %j',
  async (value) => {
    vi.stubGlobal('turnstile', value);
    const pending = load();
    const rejected = expect(pending).rejects.toThrow();
    tag().dispatchEvent(new Event('load'));
    await rejected;
    expect(tag().getAttribute('data-buildr-turnstile')).toBe('failed');
  },
);

it('requires a new load event if the API of a ready script disappears', async () => {
  vi.stubGlobal('turnstile', fakeApi());
  const pending = load();
  tag().dispatchEvent(new Event('load'));
  await pending;
  vi.stubGlobal('turnstile', { render: 'clobbered' });
  const retry = load();
  const done = vi.fn();
  void retry.then(done);
  vi.stubGlobal('turnstile', fakeApi());
  await Promise.resolve();
  expect(done).not.toHaveBeenCalled();
  tag().dispatchEvent(new Event('load'));
  await retry;
});

it('cancels only the unmounted consumer and detaches its load/error/abort listeners', async () => {
  const controller = new AbortController();
  const pending = loadTurnstile(controller.signal);
  const rejected = expect(pending).rejects.toThrow();
  const remove = vi.spyOn(tag(), 'removeEventListener');
  const removeAbort = vi.spyOn(controller.signal, 'removeEventListener');
  const other = load();
  controller.abort();
  await rejected;
  expect(remove.mock.calls.map((call) => call[0])).toEqual(['load', 'error']);
  expect(removeAbort).toHaveBeenCalledWith('abort', expect.any(Function));
  vi.stubGlobal('turnstile', fakeApi());
  tag().dispatchEvent(new Event('load'));
  await other;
  expect(await load()).toBeDefined();
  expect(scripts()).toHaveLength(1);
});

it('records a load after all consumers leave so a later mount can reuse the ready API', async () => {
  const controller = new AbortController();
  const pending = loadTurnstile(controller.signal);
  const rejected = expect(pending).rejects.toThrow();
  controller.abort();
  await rejected;
  vi.stubGlobal('turnstile', fakeApi());
  tag().dispatchEvent(new Event('load'));
  expect(tag().getAttribute('data-buildr-turnstile')).toBe('ready');
  await load();
  expect(scripts()).toHaveLength(1);
});

it('never injects for an already cancelled request', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(loadTurnstile(controller.signal)).rejects.toThrow();
  expect(scripts()).toHaveLength(0);
});

it.each([
  ['<script nonce="script-nonce"></script>', 'script-nonce'],
  ['<script nonce=""></script><script nonce="second-nonce"></script>', 'second-nonce'],
  ['<script nonce=" "></script><meta name="csp-nonce" content="meta-nonce">', 'meta-nonce'],
  [
    '<script nonce="script-nonce"></script><meta name="csp-nonce" content="meta-nonce">',
    'script-nonce',
  ],
  ['<script nonce=""></script><meta name="csp-nonce" content="meta-nonce">', 'meta-nonce'],
  ['<script nonce="  script-value  " ></script>', 'script-value'],
  ['<meta name="csp-nonce" content="  meta-value  ">', 'meta-value'],
  ['', ''],
  ['<meta name="csp-nonce" content="">', ''],
  ['<meta name="csp-nonce" content=" ">', ''],
])('copies the first nonempty nonce or the meta fallback: %s', async (carriers, expected) => {
  document.head.innerHTML = carriers;
  const pending = load();
  expect(tag().nonce).toBe(expected);
  expect(tag().hasAttribute('nonce')).toBe(expected !== '');
  vi.stubGlobal('turnstile', fakeApi());
  tag().dispatchEvent(new Event('load'));
  await pending;
});

it('ignores a marked script with a different URL', async () => {
  document.head.innerHTML =
    '<script data-buildr-turnstile="ready" src="https://example.test/api.js"></script>';
  const pending = load();
  const exact = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SCRIPT_URL}"]`);
  expect(exact?.getAttribute('data-buildr-turnstile')).toBe('loading');
  vi.stubGlobal('turnstile', fakeApi());
  exact?.dispatchEvent(new Event('load'));
  await pending;
});

it('replaces a planted inert exact-URL tag instead of trusting its state', async () => {
  document.head.innerHTML = `<script data-buildr-turnstile="ready" src="${TURNSTILE_SCRIPT_URL}"></script>`;
  const foreign = tag();
  vi.stubGlobal('turnstile', fakeApi());
  const pending = load();
  expect(foreign.isConnected).toBe(false);
  expect(tag()).not.toBe(foreign);
  expect(tag().getAttribute('data-buildr-turnstile')).toBe('loading');
  tag().dispatchEvent(new Event('load'));
  await pending;
});

it('rejects all consumers after the load deadline and allows a fresh retry', async () => {
  vi.useFakeTimers();
  const first = expect(load()).rejects.toThrow('Turnstile unavailable');
  const second = expect(load()).rejects.toThrow('Turnstile unavailable');
  const old = tag();
  await vi.advanceTimersByTimeAsync(15_000);
  await Promise.all([first, second]);
  expect(old.getAttribute('data-buildr-turnstile')).toBe('failed');
  expect(old.isConnected).toBe(false);
  const retry = load();
  expect(tag()).not.toBe(old);
  vi.stubGlobal('turnstile', fakeApi());
  tag().dispatchEvent(new Event('load'));
  await retry;
});
