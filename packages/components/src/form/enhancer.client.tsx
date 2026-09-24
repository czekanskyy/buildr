'use client';

import { useEffect, useRef, useState } from 'react';

export interface FormEnhancerProps {
  /** Where to send the form. Without a URL (a server action, or no platform) the browser does the submitting. */
  readonly action: string | undefined;
  readonly sending: string;
  readonly success: string;
  readonly failure: string;
}

/**
 * Progressive enhancement only: sends the form with `fetch`, keeps the person on the page and tells
 * them the result in a live region. It validates nothing (the server does, from the document's own
 * schema) and shows only what the server says was wrong with each field. Without JavaScript the
 * form is submitted the ordinary way and none of this runs.
 */
export function FormEnhancer({ action, sending, success, failure }: FormEnhancerProps) {
  const status = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const form = status.current?.closest('form');
    if (form == null || action === undefined) return;
    const url = action;
    let live = true;

    const clearErrors = () => {
      for (const control of form.querySelectorAll('[aria-invalid]')) {
        control.removeAttribute('aria-invalid');
      }
      for (const error of form.querySelectorAll<HTMLElement>('.bc-field__error')) {
        error.hidden = true;
        error.textContent = '';
      }
    };

    const showErrors = (errors: unknown) => {
      if (typeof errors !== 'object' || errors === null) return;
      for (const [name, text] of Object.entries(errors)) {
        if (typeof text !== 'string') continue;
        const control = form.elements.namedItem(name);
        if (!(control instanceof HTMLElement)) continue;
        control.setAttribute('aria-invalid', 'true');
        const error = control
          .closest('.bc-field__error, div')
          ?.querySelector<HTMLElement>('.bc-field__error');
        if (error != null) {
          error.textContent = text;
          error.hidden = false;
        }
      }
    };

    const onSubmit = async (event: SubmitEvent) => {
      if (event.defaultPrevented) return;
      event.preventDefault();
      clearErrors();
      setMessage(sending);
      const buttons = [
        ...form.querySelectorAll<HTMLButtonElement>('button[type="submit"], button:not([type])'),
      ];
      for (const button of buttons) button.disabled = true;
      try {
        const response = await fetch(url, {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' },
        });
        if (!live) return;
        if (response.ok) {
          form.reset();
          setMessage(success);
        } else {
          const body: unknown = await response.json().catch(() => undefined);
          if (!live) return;
          showErrors((body as { errors?: unknown } | undefined)?.errors);
          setMessage(failure);
        }
      } catch {
        if (live) setMessage(failure);
      } finally {
        for (const button of buttons) button.disabled = false;
      }
    };

    form.addEventListener('submit', onSubmit);
    return () => {
      live = false;
      form.removeEventListener('submit', onSubmit);
    };
  }, [action, sending, success, failure]);

  return (
    <div ref={status} className="bc-form__status" role="status" aria-live="polite">
      {message}
    </div>
  );
}
