// @vitest-environment jsdom
import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { MapEnhancer } from './enhancer.client.tsx';
import { MAP_SANDBOX } from './props.ts';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
it('hydrates without warnings and loads through a native button click', async () => {
  const src = 'https://www.google.com/maps/embed/v1/place?key=FAKE';
  const tree = <MapEnhancer src={src} title="Map" notice="Notice" button="Show" />;
  const host = document.createElement('div');
  host.innerHTML = renderToString(tree);
  document.body.replaceChildren(host);
  expect(host.querySelector('button')?.hidden).toBe(true);
  const spy = vi.spyOn(console, 'error');
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    await act(async () => {
      root = hydrateRoot(host, tree);
    });
    const button = host.querySelector('button');
    expect(button?.hidden).toBe(false);
    expect(button?.tagName).toBe('BUTTON');
    expect(button?.type).toBe('button');
    expect(
      document.getElementById(button?.getAttribute('aria-describedby') ?? '')?.textContent,
    ).toBe('Notice');
    await act(async () => {
      button?.click();
    });
    const frame = host.querySelector('iframe');
    expect(frame).not.toBeNull();
    expect(frame?.getAttribute('sandbox')).toBe(MAP_SANDBOX);
    expect(frame?.getAttribute('referrerpolicy')).toBe('strict-origin');
    expect(frame?.getAttribute('loading')).toBe('lazy');
    expect(frame?.hasAttribute('allow')).toBe(false);
    expect(frame?.hasAttribute('allowfullscreen')).toBe(false);
    expect(frame?.getAttribute('src')).toBe(src);
    expect(document.activeElement).toBe(host.querySelector('iframe'));
    expect(spy).not.toHaveBeenCalled();
  } finally {
    await act(async () => root?.unmount());
    spy.mockRestore();
    host.remove();
  }
});
