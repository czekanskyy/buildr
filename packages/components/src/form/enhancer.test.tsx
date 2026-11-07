// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormEnhancer } from './enhancer.client.tsx';
import { FormView } from './view.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const texts = { sending: 'Sending…', success: 'Sent!', failure: 'Failed.' };

function mount(action: string | ((data: FormData) => void | Promise<void>) | undefined) {
  document.body.innerHTML = `<div id="root"></div>`;
  const form = document.createElement('form');
  form.innerHTML = `
    <div><input name="email" value="a@b.c" /><p class="bc-field__error" hidden></p></div>
    <button type="submit">Send</button>`;
  document.body.append(form);
  const host = document.createElement('div');
  form.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <FormEnhancer
        action={typeof action === 'string' ? action : undefined}
        serverAction={typeof action === 'function' ? action : undefined}
        {...texts}
      />,
    ),
  );
  const status = () => host.querySelector('[role="status"]')?.textContent;
  const submit = async () => {
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
  };
  return { form, status, submit, root };
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('FormEnhancer', () => {
  it('invokes a React form action exactly once and settles only after it consumed the token', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const action = vi.fn(async (data: FormData) => {
      expect(data.get('buildr-captcha')).toBe('one-use-token');
    });
    const settled = vi.fn();
    try {
      await act(async () =>
        root.render(
          FormView({
            props: { successMessage: '', errorMessage: '', ariaLabel: '' },
            root: { className: 'bc-form', 'data-buildr-form': 'forged' },
            node: { id: 'form1', type: 'buildr/form' },
            slots: {},
            env: { mode: 'production', locale: 'en', messages: {}, layoutRef: 'pages:7' },
            platform: { formAction: () => action },
            children: (
              <>
                <input type="hidden" name="buildr-captcha" defaultValue="one-use-token" />
                <button type="submit">Send</button>
              </>
            ),
          } as never),
        ),
      );
      const form = host.querySelector('form');
      if (!form) throw Error('missing form');
      expect(form.getAttribute('data-buildr-form')).toBe('form1');
      form.addEventListener('buildr-form:settled', () => {
        settled();
        expect(action).toHaveBeenCalledTimes(1);
        form.querySelector('input[name="buildr-captcha"]')?.remove();
      });
      await act(async () =>
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
      );
      expect(action).toHaveBeenCalledTimes(1);
      expect(settled).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => root.unmount());
    }
  });

  it('sends the fields with fetch, then says it worked and clears the form', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { form, status, submit } = mount('/forms/x/y');
    (form.elements.namedItem('email') as HTMLInputElement).value = 'typed';
    await submit();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/forms/x/y');
    expect(init.method).toBe('POST');
    expect((init.body as FormData).get('email')).toBe('typed');
    expect(status()).toBe('Sent!');
    // reset() returns the field to its initial value, so what was typed is gone.
    expect((form.elements.namedItem('email') as HTMLInputElement).value).toBe('a@b.c');
    expect(form.querySelector('button')?.disabled).toBe(false);
  });

  it('disables the buttons while it sends', async () => {
    let finish: (r: Response) => void = () => {};
    vi.stubGlobal('fetch', () => new Promise<Response>((r) => (finish = r)));
    const { form, status, submit } = mount('/f');
    await submit();
    expect(status()).toBe('Sending…');
    expect(form.querySelector('button')?.disabled).toBe(true);
    await act(async () => finish(new Response('{}', { status: 200 })));
    expect(form.querySelector('button')?.disabled).toBe(false);
  });

  it('shows what the server says was wrong with each field, and keeps the input', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(JSON.stringify({ errors: { email: 'Not an email', nope: 'x', bad: 5 } }), {
          status: 422,
        }),
    );
    const { form, status, submit } = mount('/f');
    await submit();
    const input = form.elements.namedItem('email') as HTMLInputElement;
    const error = form.querySelector<HTMLElement>('.bc-field__error');
    expect(status()).toBe('Failed.');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(error?.textContent).toBe('Not an email');
    expect(error?.hidden).toBe(false);
    expect(input.value).toBe('a@b.c');
  });

  it('clears old errors when the person tries again', async () => {
    const responses = [
      new Response(JSON.stringify({ errors: { email: 'Bad' } }), { status: 422 }),
      new Response('{}', { status: 200 }),
    ];
    vi.stubGlobal('fetch', async () => responses.shift());
    const { form, submit } = mount('/f');
    await submit();
    await submit();
    expect(form.querySelector('[aria-invalid]')).toBeNull();
    expect(form.querySelector<HTMLElement>('.bc-field__error')?.hidden).toBe(true);
  });

  it('reports a network failure and does not lose the input', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('offline');
    });
    const { form, status, submit } = mount('/f');
    await submit();
    expect(status()).toBe('Failed.');
    expect((form.elements.namedItem('email') as HTMLInputElement).value).toBe('a@b.c');
    expect(form.querySelector('button')?.disabled).toBe(false);
  });

  it('leaves the submitting to the browser when there is no URL', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { form } = mount(undefined);
    const event = new Event('submit', { bubbles: true, cancelable: true });
    await act(async () => {
      form.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stops listening when it is removed', async () => {
    const fetchMock = vi.fn(async () => new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    const { root, submit } = mount('/f');
    act(() => root.unmount());
    await submit();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([200, 422, 503, 0])(
    'dispatches a bubbling settled event after fetch completes (%s)',
    async (httpStatus) => {
      const codes = { 'buildr-captcha': 'captcha' };
      vi.stubGlobal('fetch', async () => {
        if (httpStatus === 0) throw new TypeError('offline');
        return new Response(JSON.stringify({ codes }), { status: httpStatus });
      });
      const { form, submit, root } = mount('/f');
      const listener = vi.fn();
      document.body.addEventListener('buildr-form:settled', listener);
      try {
        await submit();
        expect(listener).toHaveBeenCalledTimes(1);
        const event = listener.mock.calls[0]?.[0] as CustomEvent;
        expect(event.target).toBe(form);
        expect(event.bubbles).toBe(true);
        expect(event.detail).toEqual({
          status: httpStatus,
          codes: httpStatus >= 400 ? codes : undefined,
        });
        expect(form.querySelector('button')?.disabled).toBe(false);
      } finally {
        document.body.removeEventListener('buildr-form:settled', listener);
        act(() => root.unmount());
      }
    },
  );

  it.each(['success', 'reject', 'throw'] as const)(
    'settles function actions after %s and captures fields before reset',
    async (result) => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const action = vi.fn((data: FormData) => {
        expect(data.get('email')).toBe('typed');
        if (result === 'throw') throw Error('action failed');
        if (result === 'reject') return Promise.reject(Error('action rejected'));
        return Promise.resolve();
      });
      const { form, status, submit, root } = mount(action);
      (form.elements.namedItem('email') as HTMLInputElement).value = 'typed';
      const listener = vi.fn();
      form.addEventListener('buildr-form:settled', listener);
      await submit();
      expect(action).toHaveBeenCalledTimes(1);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(listener).toHaveBeenCalledTimes(1);
      const settledEvent = listener.mock.calls[0]?.[0] as CustomEvent | undefined;
      expect(settledEvent?.detail.status).toBe(result === 'success' ? 200 : 0);
      expect(status()).toBe(result === 'success' ? 'Sent!' : 'Failed.');
      expect((form.elements.namedItem('email') as HTMLInputElement).value).toBe(
        result === 'success' ? 'a@b.c' : 'typed',
      );
      act(() => root.unmount());
    },
  );
});
