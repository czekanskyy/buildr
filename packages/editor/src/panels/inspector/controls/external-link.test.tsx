// @vitest-environment jsdom
import { p } from '@next-buildr/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  normalizeExternalUrl,
  parseExternalMedia,
} from '../../../dialogs/media-picker/media-ref.ts';
import { MessagesProvider } from '../../../messages/index.tsx';
import { ExternalUrlControl } from './external-link.tsx';
import { MediaControl } from './media.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('external media values', () => {
  it('accepts only https addresses without credentials', () => {
    expect(normalizeExternalUrl(' https://cdn.example.com/a.mp4 ')).toBe(
      'https://cdn.example.com/a.mp4',
    );
    expect(normalizeExternalUrl('http://cdn.example.com/a.mp4')).toBeUndefined();
    expect(normalizeExternalUrl('https://user:pw@cdn.example.com/a')).toBeUndefined();
    expect(normalizeExternalUrl('javascript:alert(1)')).toBeUndefined();
    expect(normalizeExternalUrl('not a url')).toBeUndefined();
    expect(normalizeExternalUrl(`https://a.example/${'x'.repeat(2100)}`)).toBeUndefined();
  });

  it('reads the stored shape back and ignores the rest', () => {
    const value = { external: true, url: 'https://a.example/x.png' };
    expect(parseExternalMedia(value)).toEqual(value);
    expect(parseExternalMedia({ external: false, url: 'https://a.example' })).toBeUndefined();
    expect(parseExternalMedia(null)).toBeUndefined();
  });
});

describe('the external source warning', () => {
  let container: HTMLElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    Element.prototype.scrollIntoView ??= () => {};
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.setPointerCapture ??= () => {};
    Element.prototype.releasePointerCapture ??= () => {};
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
  });

  const render = (locale: string, node: React.ReactNode) =>
    act(async () => root.render(<MessagesProvider locale={locale}>{node}</MessagesProvider>));
  const byText = (text: string) =>
    [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(text));
  const type = (element: HTMLInputElement, value: string) =>
    act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
        element,
        value,
      );
      element.dispatchEvent(new Event('input', { bubbles: true }));
    });
  const input = () => container.querySelector('input[type="url"]') as HTMLInputElement;

  const mediaDef = p.media({ label: 'Image', accept: ['image'] });

  it('stores an external media value only after "Potwierdzam i dodaję link"', async () => {
    const onChange = vi.fn();
    await render(
      'pl',
      <MediaControl
        id="i"
        def={mediaDef}
        label="Obraz"
        describedBy={undefined}
        value={null}
        disabled={false}
        onChange={onChange}
      />,
    );
    await type(input(), 'https://cdn.example.com/a.png');
    await act(async () => byText('Dodaj link')?.click());
    const dialog = document.querySelector('[role="alertdialog"]');
    expect(dialog?.textContent).toContain('Zewnętrzne źródło');
    expect(dialog?.textContent).toContain('biblioteki mediów');
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => byText('Potwierdzam i dodaję link')?.click());
    expect(onChange).toHaveBeenCalledWith({
      external: true,
      url: 'https://cdn.example.com/a.png',
    });
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('stores nothing when the warning is cancelled', async () => {
    const onChange = vi.fn();
    await render(
      'pl',
      <MediaControl
        id="i"
        def={mediaDef}
        label="Obraz"
        describedBy={undefined}
        value={null}
        disabled={false}
        onChange={onChange}
      />,
    );
    await type(input(), 'https://cdn.example.com/a.png');
    await act(async () => byText('Dodaj link')?.click());
    await act(async () => byText('Anuluj')?.click());
    expect(onChange).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('refuses an address that is not https without opening the warning', async () => {
    const onChange = vi.fn();
    await render(
      'en',
      <MediaControl
        id="i"
        def={mediaDef}
        label="Image"
        describedBy={undefined}
        value={null}
        disabled={false}
        onChange={onChange}
      />,
    );
    await type(input(), 'http://cdn.example.com/a.png');
    await act(async () => byText('Add link')?.click());
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(container.textContent).toContain('starts with https://');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows a stored external value with its badge and removes it', async () => {
    const onChange = vi.fn();
    await render(
      'en',
      <MediaControl
        id="i"
        def={mediaDef}
        label="Image"
        describedBy={undefined}
        value={{ external: true, url: 'https://cdn.example.com/a.png' }}
        disabled={false}
        onChange={onChange}
      />,
    );
    expect(container.textContent).toContain('External');
    expect(container.textContent).toContain('https://cdn.example.com/a.png');
    await act(async () => byText('Remove')?.click());
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('asks for the same confirmation for a text address (the iframe url)', async () => {
    const onChange = vi.fn();
    await render(
      'pl',
      <ExternalUrlControl
        id="u"
        label="Adres"
        describedBy={undefined}
        value=""
        disabled={false}
        onChange={onChange}
      />,
    );
    await type(input(), 'https://maps.example.com/embed');
    await act(async () => byText('Dodaj link')?.click());
    await act(async () => byText('Anuluj')?.click());
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => byText('Dodaj link')?.click());
    await act(async () => byText('Potwierdzam i dodaję link')?.click());
    expect(onChange).toHaveBeenCalledWith('https://maps.example.com/embed');
  });
});
