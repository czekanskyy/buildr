// @vitest-environment jsdom
import {
  createMemoryDataSource,
  type Diagnostic,
  defaultTheme,
  type PreparedData,
  s,
} from '@next-buildr/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dataContext,
  doc,
  emptyData,
  node,
  platform,
  registry,
} from '../render/render.test-kit.tsx';
import { DocumentRenderer, type DocumentRendererProps } from './document-renderer.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  for (const style of document.head.querySelectorAll('style')) style.remove();
  vi.restoreAllMocks();
});

const props = (overrides: Partial<DocumentRendererProps> = {}): DocumentRendererProps => ({
  document: doc([node(1, 'buildr/text', { text: s('Hello') })]),
  registry,
  theme: defaultTheme,
  context: dataContext(),
  platform,
  ...overrides,
});

const show = async (p: DocumentRendererProps) => {
  await act(async () => {
    root.render(<DocumentRenderer {...p} />);
  });
};

describe('DocumentRenderer', () => {
  it('renders the document and hoists its styles into the head', async () => {
    const withStyles = doc([
      node(1, 'buildr/text', { text: s('Hello') }, {
        styles: { base: { layout: { gap: '1rem' } } },
      } as never),
    ]);
    await show(props({ document: withStyles }));
    expect(container.querySelector('p.bc-text.b-node000001')?.textContent).toBe('Hello');
    const css = [...document.head.querySelectorAll('style')].map((el) => el.textContent).join('\n');
    expect(css).toContain('@layer buildr.reset');
    expect(css).toContain('.b-node000001 { gap: 1rem; }');
  });

  it('renders with prepared data straight away', async () => {
    const data: PreparedData = {
      ...emptyData,
      media: { m1: { id: 'm1', url: '/a.png', alt: 'Alt', mimeType: 'image/png' } },
    };
    const d = doc([
      node(1, 'buildr/image', { image: s({ source: 'x', collection: 'media', id: 'm1' }) }),
    ]);
    await show(props({ document: d, data }));
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/a.png');
  });

  it('asks a data source and shows the fallback meanwhile', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const inner = createMemoryDataSource({
      media: { m1: { id: 'm1', url: '/late.png', mimeType: 'image/png' } },
    });
    const dataSource = {
      ...inner,
      getMedia: async (ids: readonly string[], ctx: never) => (
        await gate, inner.getMedia(ids, ctx)
      ),
    };
    const d = doc([
      node(1, 'buildr/image', { image: s({ source: 'x', collection: 'media', id: 'm1' }) }),
    ]);

    await show(props({ document: d, dataSource, fallback: <span>loading</span> }));
    expect(container.textContent).toBe('loading');
    expect(container.querySelector('img')).toBeNull();

    await act(async () => release());
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/late.png');
    expect(container.textContent).not.toContain('loading');
  });

  it('renders without media or queries when it is given neither data nor a source', async () => {
    const d = doc([
      node(1, 'buildr/image', { image: s({ source: 'x', collection: 'media', id: 'm1' }) }),
    ]);
    await show(props({ document: d }));
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders nothing for a document it cannot load, and reports why', async () => {
    const seen: (readonly Diagnostic[])[] = [];
    await show(props({ document: { schemaVersion: 99 }, onDiagnostics: (d) => seen.push(d) }));
    expect(container.innerHTML).toBe('');
    expect(seen.at(-1)?.map((d) => d.code)).toContain('document.newer-version');
  });

  it('reports diagnostics from rendering', async () => {
    const seen: (readonly Diagnostic[])[] = [];
    await show(
      props({ document: doc([node(1, 'acme/mystery')]), onDiagnostics: (d) => seen.push(d) }),
    );
    expect(seen.at(-1)?.map((d) => d.code)).toContain('render.unknown-component');
  });

  it('follows the document when it changes', async () => {
    await show(props());
    expect(container.textContent).toBe('Hello');
    await show(props({ document: doc([node(1, 'buildr/text', { text: s('Changed') })]) }));
    expect(container.textContent).toBe('Changed');
  });

  it('ignores an answer that arrives after the document changed or it unmounted', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const inner = createMemoryDataSource({
      media: { m1: { id: 'm1', url: '/x.png', mimeType: 'image/png' } },
    });
    const dataSource = {
      ...inner,
      getMedia: async (ids: readonly string[], ctx: never) => (
        await gate, inner.getMedia(ids, ctx)
      ),
    };
    const d = doc([
      node(1, 'buildr/image', { image: s({ source: 'x', collection: 'media', id: 'm1' }) }),
    ]);
    await show(props({ document: d, dataSource }));
    await act(async () => root.render(<></>));
    await act(async () => release());
    expect(error).not.toHaveBeenCalled();
  });
});
