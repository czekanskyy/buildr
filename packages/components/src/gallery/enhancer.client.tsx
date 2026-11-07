'use client';
import { useEffect, useRef } from 'react';

export interface GalleryLabels {
  dialog: string;
  close: string;
  previous: string;
  next: string;
  counter: string;
}
export function GalleryEnhancer(labels: GalleryLabels) {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const root = marker.current?.parentElement;
    const list = root?.querySelector<HTMLElement>('.bc-gallery__list');
    if (!root || !list) return;
    const owned = (link: Element) => {
      if (link.closest('.bc-gallery') !== root) return false;
      for (
        let parent = link.parentElement;
        parent && parent !== root;
        parent = parent.parentElement
      ) {
        if (
          parent !== list &&
          parent.matches(
            '[role="dialog"], [role="slider"], [role="button"], .bc-carousel, .bc-form',
          )
        )
          return false;
      }
      return true;
    };
    const links = () =>
      [...list.querySelectorAll<HTMLAnchorElement>('.bc-gallery-item__link')].filter((link) => {
        if (!owned(link)) return false;
        try {
          return ['http:', 'https:'].includes(
            new URL(link.getAttribute('href') ?? '', document.baseURI).protocol,
          );
        } catch {
          return false;
        }
      });
    const dialog = document.createElement('dialog');
    dialog.className = 'bc-gallery__dialog';
    dialog.tabIndex = -1;
    dialog.setAttribute('aria-label', labels.dialog);
    const image = document.createElement('img');
    const caption = document.createElement('p');
    const counter = document.createElement('p');
    counter.setAttribute('aria-live', 'polite');
    const button = (text: string) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.textContent = text;
      return el;
    };
    const close = button(labels.close),
      previous = button(labels.previous),
      next = button(labels.next);
    dialog.append(close, image, caption, previous, next, counter);
    root.append(dialog);
    let opener: HTMLAnchorElement | undefined;
    let index = 0;
    let shown: HTMLAnchorElement | undefined;
    const observer = new MutationObserver(() => {
      if (!dialog.open) return;
      const position = shown ? links().indexOf(shown) : -1;
      if (position < 0) onClose();
      else show(position);
    });
    const restore = () => {
      observer.disconnect();
      shown = undefined;
      if (!opener) return;
      const remaining = links();
      const target = opener.isConnected ? opener : remaining[Math.min(index, remaining.length - 1)];
      if (target) target.focus();
      else {
        list.setAttribute('tabindex', '-1');
        list.focus();
      }
      opener = undefined;
    };
    const show = (position: number) => {
      const items = links();
      index = Math.max(0, Math.min(items.length - 1, position));
      const link = items[index];
      if (!link) {
        if (dialog.open) dialog.close();
        restore();
        return;
      }
      image.referrerPolicy = 'no-referrer';
      image.src = link.href;
      image.alt = link.querySelector('img')?.alt ?? '';
      shown = link;
      caption.textContent = link.closest('figure')?.querySelector('figcaption')?.textContent ?? '';
      counter.textContent = labels.counter
        .replace('{index}', String(index + 1))
        .replace('{total}', String(items.length));
      const disablePrevious = items.length <= 1 || index === 0;
      const disableNext = items.length <= 1 || index === items.length - 1;
      if (
        (document.activeElement === previous && disablePrevious) ||
        (document.activeElement === next && disableNext)
      ) {
        const target = !disablePrevious ? previous : !disableNext ? next : dialog;
        if (target instanceof HTMLButtonElement) target.disabled = false;
        target.focus();
      }
      previous.disabled = disablePrevious;
      next.disabled = disableNext;
    };
    const click = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>('.bc-gallery-item__link')
          : null;
      if (!link || typeof dialog.showModal !== 'function') return;
      const position = links().indexOf(link);
      if (position < 0) return;
      event.preventDefault();
      opener = link;
      show(position);
      dialog.showModal();
      observer.observe(list, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
      });
    };
    const onClose = () => {
      dialog.close();
      restore();
    };
    const back = () => show(index - 1);
    const forward = () => show(index + 1);
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        show(index + (event.key === 'ArrowLeft' ? -1 : 1));
      }
    };
    root.addEventListener('click', click);
    close.addEventListener('click', onClose);
    previous.addEventListener('click', back);
    next.addEventListener('click', forward);
    dialog.addEventListener('keydown', key);
    dialog.addEventListener('close', restore);
    return () => {
      observer.disconnect();
      root.removeEventListener('click', click);
      close.removeEventListener('click', onClose);
      previous.removeEventListener('click', back);
      next.removeEventListener('click', forward);
      dialog.removeEventListener('keydown', key);
      if (dialog.open) dialog.close();
      restore();
      dialog.removeEventListener('close', restore);
      dialog.remove();
    };
  }, [labels.dialog, labels.close, labels.previous, labels.next, labels.counter]);
  return <span ref={marker} hidden data-gallery-enhancer="" />;
}
