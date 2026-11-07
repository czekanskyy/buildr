import { TURNSTILE_SCRIPT_URL } from './constants.ts';

export interface TurnstileParameters {
  sitekey: string;
  action: string;
  cData: string;
  'response-field-name': string;
  size: 'normal';
  theme: 'auto';
  appearance: 'always';
  language: string;
  callback: () => void;
  'expired-callback': () => void;
  'error-callback': () => void;
  'timeout-callback': () => void;
}
export interface Turnstile {
  render(container: HTMLElement, parameters: TurnstileParameters): string;
  reset(id: string): void;
  remove(id: string): void;
}

function api(): Turnstile | undefined {
  const value = (window as Window & { turnstile?: Turnstile }).turnstile;
  return typeof value?.render === 'function' ? value : undefined;
}

const ownedScripts = new WeakSet<HTMLScriptElement>();

function nonce(): string | undefined {
  for (const script of document.querySelectorAll<HTMLScriptElement>('script[nonce]')) {
    const value = script.nonce || script.getAttribute('nonce');
    if (value?.trim()) return value.trim();
  }
  const content = document.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]')?.content;
  return content?.trim() || undefined;
}

/** The script owns shared state; individual consumers own and cancel their listeners. */
export function loadTurnstile(signal: AbortSignal): Promise<Turnstile> {
  if (signal.aborted) return Promise.reject(new Error('Cancelled'));
  let script = document.querySelector<HTMLScriptElement>(
    `script[data-buildr-turnstile][src="${TURNSTILE_SCRIPT_URL}"]`,
  );
  if (script && !ownedScripts.has(script)) {
    script.remove();
    script = null;
  }
  if (script?.getAttribute('data-buildr-turnstile') === 'ready') {
    const ready = api();
    if (ready) return Promise.resolve(ready);
    script.setAttribute('data-buildr-turnstile', 'failed');
  }
  if (script?.getAttribute('data-buildr-turnstile') === 'failed') {
    script.remove();
    script = null;
  }
  let inject = false;
  if (!script) {
    script = document.createElement('script');
    ownedScripts.add(script);
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.setAttribute('data-buildr-turnstile', 'idle');
    const value = nonce();
    if (value) script.nonce = value;
    inject = true;
  }
  const tag = script;
  if (tag.getAttribute('data-buildr-turnstile') === 'idle') {
    // Global timers are injectable by the host/test environment.
    const deadline = globalThis.setTimeout(() => {
      tag.setAttribute('data-buildr-turnstile', 'failed');
      tag.dispatchEvent(new Event('error'));
      tag.remove();
    }, 15_000);
    tag.onload = () => {
      globalThis.clearTimeout(deadline);
      tag.setAttribute('data-buildr-turnstile', api() ? 'ready' : 'failed');
      tag.onload = null;
      tag.onerror = null;
    };
    tag.onerror = () => {
      globalThis.clearTimeout(deadline);
      tag.setAttribute('data-buildr-turnstile', 'failed');
      tag.onload = null;
      tag.onerror = null;
    };
    tag.setAttribute('data-buildr-turnstile', 'loading');
  }
  return new Promise((resolve, reject) => {
    const clean = () => {
      tag.removeEventListener('load', loaded);
      tag.removeEventListener('error', failed);
      signal.removeEventListener('abort', failed);
    };
    const failed = () => {
      clean();
      reject(new Error('Turnstile unavailable'));
    };
    const loaded = () => {
      const value = tag.getAttribute('data-buildr-turnstile') === 'ready' ? api() : undefined;
      if (!value) return failed();
      clean();
      resolve(value);
    };
    tag.addEventListener('load', loaded);
    tag.addEventListener('error', failed);
    signal.addEventListener('abort', failed, { once: true });
    if (inject) document.head.append(tag);
  });
}
