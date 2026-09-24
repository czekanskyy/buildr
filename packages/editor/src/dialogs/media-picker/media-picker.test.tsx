// @vitest-environment jsdom
import { type MediaAsset, p } from '@buildr/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import { MessagesProvider } from '../../messages/index.tsx';
import { MediaControl } from '../../panels/inspector/controls/index.ts';
import type { DocumentAdapter } from '../../persistence/index.ts';
import { MediaLibraryProvider } from './library.tsx';
import { MediaPicker } from './media-picker.tsx';
import { kindsFor, mimeTypesFor, parseMediaRef, toMediaRef } from './media-ref.ts';

expect.extend(matchers);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const photo: MediaAsset = {
  id: 'm1',
  url: '/a.jpg',
  alt: 'A cat',
  width: 10,
  height: 8,
  mimeType: 'image/jpeg',
};
const manual: MediaAsset = { id: 'm2', url: '/b.pdf', mimeType: 'application/pdf' };

describe('media references', () => {
  it('stores a reference with a snapshot and reads it back', () => {
    const ref = toMediaRef(photo, 'media');
    expect(ref).toEqual({
      source: 'payload',
      collection: 'media',
      id: 'm1',
      snapshot: { url: '/a.jpg', alt: 'A cat', width: 10, height: 8, mimeType: 'image/jpeg' },
    });
    expect(parseMediaRef(ref)).toEqual(ref);
    expect(parseMediaRef(null)).toBeUndefined();
    expect(parseMediaRef({ id: 'x' })).toBeUndefined();
  });

  it('narrows the kinds by what the prop accepts', () => {
    expect(kindsFor(undefined)).toContain('video');
    expect(kindsFor(['image'])).toEqual(['image']);
    expect(kindsFor(['nonsense'])).toContain('all');
    expect(mimeTypesFor('all')).toBeUndefined();
    expect(mimeTypesFor('image')).toEqual(['image/*']);
  });
});

describe('the media picker and control', () => {
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

  function library(overrides: Partial<DocumentAdapter['media']> = {}) {
    const search = vi.fn(async (query: { text?: string; cursor?: string }) => {
      if (query.cursor === 'page2') return { items: [manual] };
      if (query.text === 'none') return { items: [] };
      return { items: [photo], nextCursor: 'page2' };
    });
    const media = { search, ...overrides } as DocumentAdapter['media'];
    return { media, search };
  }

  const render = async (node: React.ReactNode) =>
    act(async () => root.render(<MessagesProvider locale="en">{node}</MessagesProvider>));
  const byText = (text: string) =>
    [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(text));
  const settle = () => act(async () => void (await new Promise((done) => setTimeout(done, 10))));
  const setValue = (element: HTMLInputElement, value: string) =>
    act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
        element,
        value,
      );
      element.dispatchEvent(new Event('input', { bubbles: true }));
    });

  it('lists the library, pages it and picks with the keyboard-reachable buttons', async () => {
    const { media, search } = library();
    const onPick = vi.fn();
    const onOpenChange = vi.fn();
    await render(
      <MediaLibraryProvider media={media}>
        <MediaPicker open onOpenChange={onOpenChange} onPick={onPick} searchDelayMs={0} />
      </MediaLibraryProvider>,
    );
    await settle();
    expect(document.querySelectorAll('.bd-media-item')).toHaveLength(1);
    await act(async () => byText('Load more')?.click());
    expect(search).toHaveBeenLastCalledWith({ cursor: 'page2' });
    expect(document.querySelectorAll('.bd-media-item')).toHaveLength(2);
    await act(async () => (document.querySelector('.bd-media-item') as HTMLElement).click());
    expect(onPick).toHaveBeenCalledWith(photo);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('searches and says when nothing matches', async () => {
    const { media, search } = library();
    await render(
      <MediaLibraryProvider media={media}>
        <MediaPicker
          open
          onOpenChange={() => undefined}
          onPick={() => undefined}
          searchDelayMs={0}
        />
      </MediaLibraryProvider>,
    );
    await setValue(document.querySelector('input[type=search]') as HTMLInputElement, 'none');
    await settle();
    expect(search).toHaveBeenLastCalledWith({ text: 'none' });
    expect(document.body.textContent).toContain('No files found.');
  });

  it('will not upload without alternative text, then picks the new file', async () => {
    const upload = vi.fn(async () => photo);
    const { media } = library({ upload });
    const onPick = vi.fn();
    await render(
      <MediaLibraryProvider media={media}>
        <MediaPicker open onOpenChange={() => undefined} onPick={onPick} searchDelayMs={0} />
      </MediaLibraryProvider>,
    );
    const submit = byText('Upload and use') as HTMLButtonElement;
    const file = new File(['x'], 'cat.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type=file]') as HTMLInputElement;
    await act(async () => {
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(submit.disabled).toBe(true);
    await setValue(
      document.querySelector('input[aria-label^="Alternative"]') as HTMLInputElement,
      'A cat',
    );
    expect(submit.disabled).toBe(false);
    await act(async () => submit.click());
    expect(upload).toHaveBeenCalledWith(file, 'A cat');
    expect(onPick).toHaveBeenCalledWith(photo);
  });

  it('shows a failed library as a retryable error', async () => {
    const search = vi
      .fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValue({ items: [] });
    await render(
      <MediaLibraryProvider media={{ search } as DocumentAdapter['media']}>
        <MediaPicker
          open
          onOpenChange={() => undefined}
          onPick={() => undefined}
          searchDelayMs={0}
        />
      </MediaLibraryProvider>,
    );
    await settle();
    expect(document.querySelector('[role=alert]')?.textContent).toContain('could not be reached');
    await act(async () => byText('Try again')?.click());
    expect(document.body.textContent).toContain('No files found.');
  });

  it('the control chooses, replaces and removes', async () => {
    const { media } = library();
    const onChange = vi.fn();
    const def = p.media({ accept: ['image'] });
    const mount = (value: unknown) =>
      render(
        <MediaLibraryProvider media={media} collection="uploads">
          <MediaControl
            id="c"
            def={def}
            label="Image"
            describedBy={undefined}
            value={value}
            disabled={false}
            onChange={onChange}
          />
        </MediaLibraryProvider>,
      );
    await mount(null);
    expect(container.textContent).toContain('No file chosen.');
    await act(async () => byText('Choose file')?.click());
    await settle();
    await act(async () => (document.querySelector('.bd-media-item') as HTMLElement).click());
    expect(onChange).toHaveBeenLastCalledWith(toMediaRef(photo, 'uploads'));

    await mount(toMediaRef(photo, 'uploads'));
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('A cat');
    expect(byText('Replace')).toBeDefined();
    await act(async () => byText('Remove')?.click());
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('the control says so without a library', async () => {
    await render(
      <MediaControl
        id="c"
        def={p.media()}
        label="Image"
        describedBy={undefined}
        value={null}
        disabled={false}
        onChange={() => undefined}
      />,
    );
    expect(container.textContent).toContain('No media library is connected.');
    expect((byText('Choose file') as HTMLButtonElement).disabled).toBe(true);
  });

  it('has no accessibility violations', async () => {
    const { media } = library();
    await render(
      <MediaLibraryProvider media={media}>
        <MediaPicker
          open
          onOpenChange={() => undefined}
          onPick={() => undefined}
          searchDelayMs={0}
        />
      </MediaLibraryProvider>,
    );
    await settle();
    const dialog = document.querySelector('[role=dialog]') as HTMLElement;
    expect((await axe(dialog)).violations).toEqual([]);
  });
});
