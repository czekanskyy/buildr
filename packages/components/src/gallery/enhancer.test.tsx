// @vitest-environment jsdom
// biome-ignore-all lint/style/noNonNullAssertion: Controlled test DOM.
// biome-ignore-all lint/a11y/useSemanticElements: Mirrors the Loop-compatible production markup.
import { act, StrictMode } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GalleryEnhancer } from './enhancer.client.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const labels = {
  dialog: 'Image viewer',
  close: 'Close',
  previous: 'Previous',
  next: 'Next',
  counter: 'Image {index} of {total}',
};
let roots: Root[] = [];
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
    this.querySelector('button')?.focus();
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
});
afterEach(() => {
  act(() => {
    for (const root of roots) root.unmount();
  });
  roots = [];
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function tree(count = 3, enhanced = true) {
  return (
    <div className="bc-gallery">
      <div className="bc-gallery__list" role="list">
        {Array.from({ length: count }, (_, i) => (
          <div role="listitem" key={String(i)}>
            <figure>
              <a className="bc-gallery-item__link" href={`/image-${i}.png`}>
                <img alt={`Landscape ${i}`} />
              </a>
              <figcaption>{`Caption ${i}`}</figcaption>
            </figure>
          </div>
        ))}
      </div>
      {enhanced && <GalleryEnhancer {...labels} />}
    </div>
  );
}
function mount(count = 3) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  act(() =>
    root.render(
      <StrictMode>
        {tree(count)}
        {tree(1)}
      </StrictMode>,
    ),
  );
  const gallery = host.querySelector('.bc-gallery')!;
  const link = gallery.querySelector('a')!;
  const dialog = gallery.querySelector('dialog')!;
  return { host, gallery, link, dialog, root };
}
function click(target: Element, options: MouseEventInit = {}) {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, ...options });
  act(() => target.dispatchEvent(event));
  return event;
}
it('opens only its own dialog, navigates, counts, and returns focus on close and native Escape close', () => {
  const { host, link, dialog } = mount();
  expect(dialog.open).toBe(false);
  click(link);
  expect(dialog.open).toBe(true);
  expect(host.querySelectorAll('dialog[open]')).toHaveLength(1);
  expect(dialog.querySelector('img')?.src).toContain('/image-0.png');
  expect(dialog.textContent).toContain('Image 1 of 3');
  act(() =>
    dialog.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
    ),
  );
  expect(dialog.querySelector('img')?.alt).toBe('Landscape 1');
  expect(dialog.textContent).toContain('Image 2 of 3');
  act(() =>
    dialog.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }),
    ),
  );
  click(dialog.querySelector('button')!);
  expect(document.activeElement).toBe(link);
  const second = host.querySelectorAll('.bc-gallery')[1]!;
  const secondDialog = second.querySelector('dialog')!;
  expect(secondDialog.open).toBe(false);
  expect(secondDialog.querySelector('img')?.getAttribute('src')).toBeNull();
  const secondLink = second.querySelector('a')!;
  secondLink.href = '/second-gallery.png';
  click(secondLink);
  expect(dialog.open).toBe(false);
  expect(secondDialog.open).toBe(true);
  expect(host.querySelectorAll('dialog[open]')).toHaveLength(1);
  expect(secondDialog.querySelector('img')?.getAttribute('src')).toContain('/second-gallery.png');
  click(secondDialog.querySelector('button')!);
  click(link);
  act(() => dialog.close());
  expect(document.activeElement).toBe(link);
});
it('ignores modifiers, middle clicks, prevented clicks, unsafe URLs and nested widgets', () => {
  const { link, dialog } = mount();
  for (const options of [
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { altKey: true },
    { button: 1 },
  ]) {
    click(link, options);
    expect(dialog.open).toBe(false);
  }
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  event.preventDefault();
  act(() => link.dispatchEvent(event));
  expect(dialog.open).toBe(false);
  for (const href of ['javascript:alert(1)', 'data:image/png,abc']) {
    link.setAttribute('href', href);
    click(link);
    expect(dialog.open).toBe(false);
  }
  link.setAttribute('href', '/safe');
  link.parentElement!.setAttribute('role', 'slider');
  click(link);
  expect(dialog.open).toBe(false);
  link.parentElement!.setAttribute('role', 'button');
  click(link);
  expect(dialog.open).toBe(false);
});
it.each(['carousel', 'form', 'dialog'])('opens inside an ancestor %s region', (kind) => {
  const { host, link, dialog } = mount();
  if (kind === 'dialog') host.setAttribute('role', 'dialog');
  else host.className = `bc-${kind}`;
  if (kind === 'carousel') {
    const slide = document.createElement('div');
    slide.className = 'bc-carousel-slide';
    host.before(slide);
    slide.append(host);
  }
  click(link);
  expect(dialog.open).toBe(true);
});
it('sets the image referrer policy before its source', () => {
  const { link, dialog } = mount();
  const setter = vi.spyOn(HTMLImageElement.prototype, 'src', 'set').mockImplementation(function (
    this: HTMLImageElement,
  ) {
    expect(this.referrerPolicy).toBe('no-referrer');
  });
  click(link);
  expect(setter).toHaveBeenCalled();
  expect(dialog.querySelector('img')?.referrerPolicy).toBe('no-referrer');
});
it('keeps focus inside the dialog at either navigation end', () => {
  const { link, dialog } = mount();
  click(link);
  const [, previous, next] = dialog.querySelectorAll('button');
  next!.focus();
  click(next!);
  click(next!);
  expect(document.activeElement).toBe(previous);
  expect(next!.disabled).toBe(true);
  click(previous!);
  click(previous!);
  expect(document.activeElement).toBe(next);
  expect(previous!.disabled).toBe(true);
});
it('refreshes the shown image, caption, index and total as list items change', async () => {
  const { gallery, dialog } = mount();
  const anchors = gallery.querySelectorAll('a');
  click(anchors[1]!);
  anchors[0]!.closest('[role="listitem"]')!.remove();
  await act(async () => {});
  expect(dialog.textContent).toContain('Image 1 of 2');
  const list = gallery.querySelector('.bc-gallery__list')!;
  list.append(list.firstElementChild!.cloneNode(true));
  anchors[1]!.href = '/updated.png';
  anchors[1]!.closest('figure')!.querySelector('figcaption')!.textContent = 'Updated caption';
  await act(async () => {});
  expect(dialog.textContent).toContain('Image 1 of 3');
  expect(dialog.textContent).toContain('Updated caption');
  expect(dialog.querySelector('img')?.src).toContain('/updated.png');
  anchors[1]!.closest('[role="listitem"]')!.remove();
  await act(async () => {});
  expect(dialog.open).toBe(false);
  expect(document.activeElement).toBe(gallery.querySelector('a'));
});
it('restores focus to nearest remaining link or the list when the opener disappears', () => {
  const { gallery, link, dialog } = mount();
  click(link);
  link.remove();
  act(() => dialog.close());
  expect(document.activeElement).toBe(gallery.querySelector('a'));
  const next = gallery.querySelector('a')!;
  click(next);
  for (const anchor of gallery.querySelectorAll('a')) anchor.remove();
  act(() => dialog.close());
  expect(document.activeElement).toBe(gallery.querySelector('.bc-gallery__list'));
});
it('cleans dialogs and listeners and restores focus on enhancer unmount in StrictMode', () => {
  const { gallery, link, dialog, root } = mount();
  click(link);
  act(() =>
    root.render(
      <StrictMode>
        {tree(3, false)}
        {tree(1, false)}
      </StrictMode>,
    ),
  );
  expect(document.activeElement).toBe(link);
  expect(document.querySelectorAll('dialog')).toHaveLength(0);
  expect(dialog.isConnected).toBe(false);
  click(link);
  expect(gallery.querySelector('dialog')).toBeNull();
});
it.each([0, 1])('handles %i images', (count) => {
  const { link, dialog } = mount(count);
  if (link) {
    click(link);
    expect([...dialog.querySelectorAll('button')].slice(1).every((b) => b.disabled)).toBe(true);
  } else expect(dialog.open).toBe(false);
});
it('hydrates without recoverable or console errors', async () => {
  const host = document.createElement('div');
  host.innerHTML = renderToString(tree());
  document.body.append(host);
  const error = vi.spyOn(console, 'error');
  const recover = vi.fn();
  await act(async () => {
    roots.push(hydrateRoot(host, tree(), { onRecoverableError: recover }));
  });
  expect(error).not.toHaveBeenCalled();
  expect(recover).not.toHaveBeenCalled();
});
