// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormEnhancer } from './enhancer.client.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const texts = { sending: 'Sending…', success: 'Sent!', failure: 'Failed.' };

function mount(action: string | undefined) {
  document.body.innerHTML = `<div id="root"></div>`;
  const form = document.createElement('form');
  form.innerHTML = `
    <div><input name="email" value="a@b.c" /><p class="bc-field__error" hidden></p></div>
    <button type="submit">Send</button>`;
  document.body.append(form);
  const host = document.createElement('div');
  form.append(host);
  const root = createRoot(host);
  act(() => root.render(<FormEnhancer action={action} {...texts} />));
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
});
