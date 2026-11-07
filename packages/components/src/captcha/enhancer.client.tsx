'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { captchaCData } from './cdata.ts';
import { CAPTCHA_ACTION, CAPTCHA_FIELD } from './constants.ts';
import { loadTurnstile, type Turnstile } from './turnstile.ts';

export interface CaptchaTexts {
  readonly notice: string;
  readonly button: string;
  readonly loading: string;
  readonly ready: string;
  readonly expired: string;
  readonly error: string;
  readonly unavailable: string;
}

/** Best-effort canvas diagnostic, without accessing the provider. */
export function CaptchaCanvasHint({ text, duplicate }: { text: string; duplicate: string }) {
  const host = useRef<HTMLSpanElement>(null);
  const [duplicated, setDuplicated] = useState(false);
  useEffect(() => {
    const form = host.current?.closest('form');
    if (!form) return;
    const check = () =>
      setDuplicated(
        [...form.querySelectorAll('[data-bc-captcha]')].filter(
          (node) => node.closest('form') === form,
        ).length > 1,
      );
    check();
    const observer = new MutationObserver(check);
    observer.observe(form, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return <span ref={host}>{duplicated ? duplicate : text}</span>;
}

export function CaptchaEnhancer({
  siteKey,
  layoutRef,
  locale,
  clickToLoad,
  texts,
}: {
  siteKey: string;
  layoutRef: string;
  locale: string;
  clickToLoad: boolean;
  texts: CaptchaTexts;
}) {
  const [mounted, setMounted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const [status, setStatus] = useState('');
  const host = useRef<HTMLDivElement>(null);
  const statusRegion = useRef<HTMLDivElement>(null);
  const { loading, ready, expired, error, unavailable } = texts;
  const noticeId = useId();
  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    if (clickToLoad && attempt === 0) return;
    const container = host.current;
    const form = container?.closest('form');
    const formId = form?.getAttribute('data-buildr-form');
    if (!container || !form || !formId || !layoutRef || !globalThis.crypto?.subtle) {
      setState('failed');
      setStatus(unavailable);
      return;
    }
    let live = true;
    let provider: Turnstile | undefined;
    let widgetId: string | undefined;
    const controller = new AbortController();
    // React owns the host; the provider owns this separate child and its hidden input.
    const child = document.createElement('div');
    container.append(child);
    const reset = (text: string) => {
      if (!live) return;
      setStatus(text);
      if (provider && widgetId !== undefined) {
        try {
          provider.reset(widgetId);
        } catch {
          setStatus(unavailable);
        }
      }
    };
    const settled = (event: Event) => {
      if (event.target !== form) return;
      const detail: unknown = (event as CustomEvent).detail;
      const result = detail as
        | { status?: unknown; code?: unknown; codes?: Record<string, unknown> }
        | undefined;
      reset(
        result?.status === 503 && result?.code === 'captcha-unavailable'
          ? unavailable
          : result?.codes?.[CAPTCHA_FIELD]
            ? error
            : result?.status === 0
              ? error
              : '',
      );
    };
    form.addEventListener('buildr-form:settled', settled);
    setState('loading');
    setStatus(loading);
    void (async () => {
      try {
        const cData = await captchaCData(layoutRef, formId);
        if (!live) return;
        provider = await loadTurnstile(controller.signal);
        if (!live) return;
        widgetId = provider.render(child, {
          sitekey: siteKey,
          action: CAPTCHA_ACTION,
          cData,
          'response-field-name': CAPTCHA_FIELD,
          size: 'normal',
          theme: 'auto',
          appearance: 'always',
          language: /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(locale) ? locale : 'auto',
          callback: () => {
            if (live) setStatus(ready);
          },
          'expired-callback': () => reset(expired),
          'error-callback': () => reset(error),
          'timeout-callback': () => reset(expired),
        });
        setState('ready');
      } catch {
        if (live) {
          setState('failed');
          setStatus(unavailable);
        }
      }
    })();
    return () => {
      live = false;
      controller.abort();
      form.removeEventListener('buildr-form:settled', settled);
      try {
        if (typeof provider?.remove === 'function' && widgetId !== undefined)
          provider.remove(widgetId);
      } catch {
        // A damaged provider must not prevent removal of its owned DOM.
      }
      child.remove();
    };
  }, [
    attempt,
    clickToLoad,
    siteKey,
    layoutRef,
    locale,
    loading,
    ready,
    expired,
    error,
    unavailable,
  ]);
  return (
    <div className="bc-captcha__enhancer">
      <p id={noticeId} className="bc-captcha__notice">
        {texts.notice}
      </p>
      <button
        type="button"
        className="bc-captcha__button"
        hidden={!mounted || state === 'ready'}
        disabled={state === 'loading'}
        aria-describedby={noticeId}
        onClick={() => {
          statusRegion.current?.focus();
          setAttempt((value) => value + 1);
        }}
      >
        {texts.button}
      </button>
      <div ref={statusRegion} role="status" aria-live="polite" tabIndex={-1}>
        {status}
      </div>
      <div ref={host} className="bc-captcha__widget" />
    </div>
  );
}
