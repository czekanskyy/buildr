// @vitest-environment jsdom
import { createRegistryMeta } from '@buildr/core';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import { DEFAULT_BREAKPOINTS } from '../app/config.ts';
import { MessagesProvider } from '../messages/index.tsx';
import { createEditorStore, EditorStoreProvider } from '../store/index.ts';
import { CanvasFrame, canvasSource, createSession } from './canvas-frame.tsx';

expect.extend(matchers);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = '';
});

const locales = { locales: ['en'], default: 'en', fallback: true, intl: {} };

describe('session and URL', () => {
  it('makes an unguessable, URL-safe nonce every time', () => {
    const a = createSession();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(createSession()).not.toBe(a);
  });

  it('puts the session in the canvas URL and takes the origin from it', () => {
    const { src, origin } = canvasSource('https://canvas.example.com/__canvas?x=1', 'abc');
    expect(origin).toBe('https://canvas.example.com');
    expect(new URL(src).searchParams.get('session')).toBe('abc');
    expect(new URL(src).searchParams.get('x')).toBe('1');
  });
});

describe('CanvasFrame', () => {
  it('shows the connecting state, then an error screen that reloads with a new session', async () => {
    const store = createEditorStore({
      doc: {
        schemaVersion: 1,
        root: 'root',
        nodes: { root: { id: 'root', type: 'buildr/page' } },
        components: {},
      },
      registry: createRegistryMeta({ components: [] }),
      validationDelayMs: null,
    });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <MessagesProvider locale="en">
          <EditorStoreProvider store={store}>
            <CanvasFrame
              canvasUrl="https://canvas.example.com/__canvas"
              manifestHash="hash"
              locales={locales}
              breakpoints={DEFAULT_BREAKPOINTS}
              handshakeTimeoutMs={30}
            />
          </EditorStoreProvider>
        </MessagesProvider>,
      ),
    );
    const iframe = () => container.querySelector('iframe');
    expect(container.querySelector('[role=status]')?.textContent).toContain('Connecting');
    expect(iframe()?.getAttribute('title')).toBe('Page preview');
    const firstSrc = iframe()?.getAttribute('src');
    expect(firstSrc).toContain('https://canvas.example.com/__canvas?session=');

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
    });
    expect(container.querySelector('[role=alert]')?.textContent).toContain('did not answer');
    expect(await axe(container.querySelector('[role=alert]') as HTMLElement)).toHaveNoViolations();

    const reload = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === 'Reload canvas',
    );
    await act(async () => reload?.click());
    expect(iframe()?.getAttribute('src')).not.toBe(firstSrc);
    expect(container.querySelector('[role=alert]')).toBeNull();
    expect(container.querySelector('[role=status]')).not.toBeNull();
    await act(async () => root.unmount());
  });
});
