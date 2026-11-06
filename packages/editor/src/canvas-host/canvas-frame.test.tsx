// @vitest-environment jsdom
import { createRegistryMeta } from '@next-buildr/core';
import { createMessage, parseEditorMessage } from '@next-buildr/core/protocol';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import { DEFAULT_BREAKPOINTS } from '../app/config.ts';
import { MessagesProvider } from '../messages/index.tsx';
import { createEditorStore, EditorStoreProvider } from '../store/index.ts';
import {
  CanvasFrame,
  canvasSource,
  createSession,
  stageMetrics,
  typeLabelsOf,
} from './canvas-frame.tsx';
import type { CanvasHost } from './host.ts';

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
    let host: CanvasHost | null = null;
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
              onHost={(value) => {
                host = value;
              }}
            />
          </EditorStoreProvider>
        </MessagesProvider>,
      ),
    );
    const iframe = () => container.querySelector('iframe');
    expect(container.querySelector('[role=status]')?.textContent).toContain('Connecting');
    expect(iframe()?.getAttribute('title')).toBe('Page preview');
    expect(container.querySelector('.bd-canvas-width')?.textContent).toBe('Desktop · 1280 px');
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    act(() => host?.state.setState({ status: 'initializing' }));
    expect(container.querySelector('[role=status]')?.textContent).toContain('Connecting');
    act(() => host?.state.setState({ status: 'ready' }));
    expect(container.querySelector('[role=status]')?.textContent).toContain(
      'This page is still empty',
    );
    expect(container.querySelector('[aria-busy="false"]')).not.toBeNull();
    act(() => host?.state.setState({ status: 'connecting' }));
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

  it('has the device label, and the empty-page actions call back', async () => {
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
    let host: CanvasHost | null = null;
    const calls: string[] = [];
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
              emptyPage={{
                onAddBlock: () => calls.push('add'),
                onPickPattern: () => calls.push('pattern'),
              }}
              onHost={(value) => {
                host = value;
              }}
            />
          </EditorStoreProvider>
        </MessagesProvider>,
      ),
    );
    const label = container.querySelector('.bd-device-label');
    expect(label?.textContent).toBe('Desktop · 1280 px');
    expect(container.querySelector('.bd-canvas-actions')).toBeNull();
    act(() => host?.state.setState({ status: 'ready' }));
    const buttons = [...container.querySelectorAll('.bd-canvas-actions button')];
    expect(buttons.map((b) => b.textContent)).toEqual(['Add block', 'Choose a pattern']);
    act(() => (buttons[0] as HTMLButtonElement).click());
    act(() => (buttons[1] as HTMLButtonElement).click());
    expect(calls).toEqual(['add', 'pattern']);
    await act(async () => root.unmount());
  });
});

describe('typeLabelsOf', () => {
  it('keeps valid localized names and drops what the protocol would refuse', () => {
    const labels = typeLabelsOf({
      'buildr/heading': { label: 'Nagłówek' },
      'buildr/rich-text': { label: '  Tekst sformatowany ' },
      'bad id': { label: 'x' },
      'buildr/markup': { label: '<b>x</b>' },
      'buildr/control': { label: 'a\nb' },
      'buildr/empty': { label: ' ' },
      'buildr/none': {},
      'buildr/long': { label: 'x'.repeat(60) },
    });
    expect(labels).toEqual({
      'buildr/heading': 'Nagłówek',
      'buildr/rich-text': 'Tekst sformatowany',
      'buildr/long': 'x'.repeat(40),
    });
  });

  it('cuts to 40 UTF-16 units, so astral characters never split or overshoot the protocol limit', () => {
    const astral = '😀'.repeat(30); // 60 UTF-16 units, 30 code points
    const mixed = `${'a'.repeat(39)}😀`; // 41 units: the pair does not fit
    const labels = typeLabelsOf({
      'buildr/astral': { label: astral },
      'buildr/mixed': { label: mixed },
    });
    expect(labels['buildr/astral']).toBe('😀'.repeat(20));
    expect(labels['buildr/mixed']).toBe('a'.repeat(39));
    for (const label of Object.values(labels)) {
      expect(label.length).toBeLessThanOrEqual(40);
      expect(label).not.toMatch(/[�-�](?![�-�])|(?<![�-�])[�-�]/);
    }
    // The canvas accepts the whole `view:set`, which it drops if one label is over its limit.
    const message = createMessage('view:set', { typeLabels: labels }, { session: 'a'.repeat(32) });
    expect(parseEditorMessage(message).ok).toBe(true);
  });

  it('is empty without a manifest and never exceeds 128 entries', () => {
    expect(typeLabelsOf(undefined)).toEqual({});
    const many = Object.fromEntries(
      Array.from({ length: 200 }, (_, i) => [`app/type-${i}`, { label: 'T' }]),
    );
    expect(Object.keys(typeLabelsOf(many))).toHaveLength(128);
  });
});
