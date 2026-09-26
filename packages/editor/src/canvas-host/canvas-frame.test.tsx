// @vitest-environment jsdom
import { createRegistryMeta } from '@next-buildr/core';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import { DEFAULT_BREAKPOINTS } from '../app/config.ts';
import { MessagesProvider } from '../messages/index.tsx';
import { createEditorStore, EditorStoreProvider } from '../store/index.ts';
import { CanvasFrame, canvasSource, createSession, stageMetrics } from './canvas-frame.tsx';

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

describe('stageMetrics', () => {
  it('fit: scales down to the room and fills the visible height', () => {
    const m = stageMetrics({ width: 1280, room: 640, roomHeight: 600, zoom: 'fit' });
    expect(m.scale).toBe(0.5);
    expect(m.frameHeight).toBe(1200);
    expect(m.stageWidth).toBe(640);
    expect(m.stageHeight).toBe(600);
    expect(m.frameHeight * m.scale).toBe(m.stageHeight);
  });

  it('fit: never scales above 100%', () => {
    const m = stageMetrics({ width: 390, room: 900, roomHeight: 500, zoom: 'fit' });
    expect(m).toMatchObject({ scale: 1, frameHeight: 500, stageWidth: 390 });
  });

  it('a fixed zoom shows 1/zoom of the page height (twice at 50%)', () => {
    const half = stageMetrics({ width: 820, room: 2000, roomHeight: 700, zoom: 0.5 });
    expect(half).toMatchObject({ scale: 0.5, frameHeight: 1400, stageWidth: 410 });
    const twice = stageMetrics({ width: 820, room: 2000, roomHeight: 700, zoom: 2 });
    expect(twice).toMatchObject({ scale: 2, frameHeight: 350, stageWidth: 1640 });
  });

  it('falls back to filling the parent while nothing is measured', () => {
    const m = stageMetrics({ width: 1280, room: 0, roomHeight: 0, zoom: 'fit' });
    expect(m).toMatchObject({ scale: 1, frameHeight: 0, stageHeight: 0, stageWidth: 1280 });
    expect(stageMetrics({ width: 100, room: 50, roomHeight: 10, zoom: 0 }).scale).toBe(1);
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
    expect(container.querySelector('.bd-canvas-width')?.textContent).toBe('Desktop · 1280px');
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
