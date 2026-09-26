import {
  type BuilderDocument,
  createMemoryDataSource,
  type DataSource,
  type PreparedData,
  s,
} from '@next-buildr/core';
import { describe, expect, it } from 'vitest';
import { dataContext, doc, node, registry } from '../render/render.test-kit.tsx';
import { createDataPreparer, DEFAULT_DATA_DEBOUNCE_MS, dataKey, NO_DATA } from './data.ts';

const media = (id: string) => s({ source: 'x', collection: 'media', id });
const image = (id: string, extra: Partial<Parameters<typeof node>[3]> = {}) =>
  node(1, 'buildr/image', { image: media(id) }, extra);
const text = (value: string) => node(2, 'buildr/text', { text: s(value) });
const page = (id: string, value: string, order: 'ab' | 'ba' = 'ab'): BuilderDocument =>
  doc(
    [image(id), text(value)],
    {},
    order === 'ab' ? ['node000001', 'node000002'] : ['node000002', 'node000001'],
  );

const context = dataContext();
const MEDIA = {
  m1: { id: 'm1', url: '/one.png', mimeType: 'image/png' },
  m2: { id: 'm2', url: '/two.png', mimeType: 'image/png' },
};

/** A data source that counts what it is asked, and can be held back. */
function countingSource(gate?: () => Promise<void>) {
  const inner = createMemoryDataSource({ media: MEDIA });
  const calls: (readonly string[])[] = [];
  const source: DataSource = {
    ...inner,
    getMedia: async (ids, ctx) => {
      calls.push(ids);
      await gate?.();
      return inner.getMedia(ids, ctx);
    },
  };
  return { source, calls };
}

/** Timers that run only when told to. */
function manualTimers() {
  let next = 1;
  const pending = new Map<number, { callback: () => void; at: number }>();
  let now = 0;
  return {
    timers: {
      setTimeout: (callback: () => void, ms: number) => {
        pending.set(next, { callback, at: now + ms });
        return next++;
      },
      clearTimeout: (handle: unknown) => void pending.delete(handle as number),
    },
    advance(ms: number) {
      now += ms;
      for (const [id, t] of [...pending]) {
        if (t.at <= now) {
          pending.delete(id);
          t.callback();
        }
      }
    },
    get size() {
      return pending.size;
    },
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(source: DataSource | undefined) {
  const clock = manualTimers();
  const data: { data: PreparedData; generation: number }[] = [];
  const loading: boolean[] = [];
  const diagnostics: string[][] = [];
  const preparer = createDataPreparer({
    registry: registry.meta,
    dataSource: source,
    timers: clock.timers,
    onData: (d, generation) => data.push({ data: d, generation }),
    onLoading: (l) => loading.push(l),
    onDiagnostics: (items) => diagnostics.push(items.map((i) => i.code)),
  });
  return { preparer, clock, data, loading, diagnostics };
}

describe('dataKey', () => {
  const key = (d: BuilderDocument, ctx = context) => dataKey(d, registry.meta, ctx);

  it('does not change with an edit to text, order or styles', () => {
    const base = key(page('m1', 'One'));
    expect(key(page('m1', 'Another text'))).toBe(base);
    expect(key(page('m1', 'One', 'ba'))).toBe(base);
    const styled = doc(
      [image('m1', { styles: { base: { layout: { gap: '1rem' } } } } as never), text('One')],
      {},
      ['node000001', 'node000002'],
    );
    expect(key(styled)).toBe(base);
  });

  it('changes with the media, and with the locale and the scopes', () => {
    const base = key(page('m1', 'One'));
    expect(key(page('m2', 'One'))).not.toBe(base);
    expect(key(page('m1', 'One'), dataContext({}, 'pl'))).not.toBe(base);
    expect(key(page('m1', 'One'), dataContext({ route: { params: { page: '2' } } }))).not.toBe(
      base,
    );
  });
});

describe('createDataPreparer', () => {
  it('fetches at once for a new document, and says it is loading meanwhile', async () => {
    const { source, calls } = countingSource();
    const { preparer, data, loading } = setup(source);
    preparer.update(page('m1', 'One'), context, 1);
    expect(loading).toEqual([true]);
    await settle();
    expect(calls).toEqual([['m1']]);
    expect(data).toHaveLength(1);
    expect(data[0]?.generation).toBe(1);
    expect(data[0]?.data.media['m1']?.url).toBe('/one.png');
    expect(loading).toEqual([true, false]);
  });

  it('never asks again for an edit to text', async () => {
    const { source, calls } = countingSource();
    const { preparer, clock } = setup(source);
    preparer.update(page('m1', 'One'), context, 1);
    await settle();
    for (const value of ['O', 'On', 'One!', 'One!!'])
      preparer.update(page('m1', value), context, 1);
    expect(clock.size).toBe(0);
    clock.advance(10_000);
    await settle();
    expect(calls).toHaveLength(1);
  });

  it('waits for quiet before asking for a changed spec, and asks once', async () => {
    const { source, calls } = countingSource();
    const { preparer, clock, data } = setup(source);
    preparer.update(page('m1', 'One'), context, 1);
    await settle();

    preparer.update(page('m2', 'One'), context, 1);
    clock.advance(DEFAULT_DATA_DEBOUNCE_MS - 1);
    expect(calls).toHaveLength(1);
    preparer.update(page('m1', 'One'), context, 1);
    preparer.update(page('m2', 'One'), context, 1);
    clock.advance(DEFAULT_DATA_DEBOUNCE_MS - 1);
    expect(calls).toHaveLength(1);
    clock.advance(1);
    await settle();
    expect(calls).toEqual([['m1'], ['m2']]);
    expect(data.at(-1)?.data.media['m2']?.url).toBe('/two.png');
  });

  it('answers a spec it has seen from the cache', async () => {
    const { source, calls } = countingSource();
    const { preparer, clock, data } = setup(source);
    preparer.update(page('m1', 'One'), context, 1);
    await settle();
    preparer.update(page('m2', 'One'), context, 1);
    clock.advance(DEFAULT_DATA_DEBOUNCE_MS);
    await settle();
    expect(calls).toHaveLength(2);

    preparer.update(page('m1', 'One'), context, 1);
    expect(clock.size).toBe(0);
    expect(data.at(-1)?.data.media['m1']?.url).toBe('/one.png');
    await settle();
    expect(calls).toHaveLength(2);
  });

  it('asks again, ignoring the cache, when the document is replaced', async () => {
    const { source, calls } = countingSource();
    const { preparer } = setup(source);
    preparer.update(page('m1', 'One'), context, 1);
    await settle();
    preparer.update(page('m1', 'One'), context, 2);
    await settle();
    expect(calls).toHaveLength(2);
  });

  it('shows only the answer to the latest request', async () => {
    const releases: (() => void)[] = [];
    const { source } = countingSource(() => new Promise<void>((resolve) => releases.push(resolve)));
    const { preparer, data } = setup(source);
    preparer.update(page('m1', 'One'), context, 1);
    preparer.update(page('m2', 'One'), context, 2);
    await settle();
    releases[1]?.();
    await settle();
    releases[0]?.();
    await settle();
    expect(data).toHaveLength(1);
    expect(data[0]?.generation).toBe(2);
    expect(data[0]?.data.media['m2']).toBeDefined();
  });

  it('reports a failing source as diagnostics and still delivers data', async () => {
    const failing: DataSource = {
      getMedia: () => Promise.reject(new Error('offline')),
      query: () => Promise.reject(new Error('offline')),
    };
    const { preparer, data, diagnostics, loading } = setup(failing);
    preparer.update(page('m1', 'One'), context, 1);
    await settle();
    expect(diagnostics.at(-1)).toContain('data.source-error');
    expect(data).toHaveLength(1);
    expect(data[0]?.data.media).toEqual({});
    expect(loading.at(-1)).toBe(false);
  });

  it('delivers no data without a source, and asks nothing', () => {
    const { preparer, data } = setup(undefined);
    preparer.update(page('m1', 'One'), context, 1);
    expect(data).toEqual([{ data: NO_DATA, generation: 1 }]);
  });

  it('does nothing once destroyed', async () => {
    const { source, calls } = countingSource();
    const { preparer, clock } = setup(source);
    preparer.update(page('m1', 'One'), context, 1);
    await settle();
    preparer.update(page('m2', 'One'), context, 1);
    preparer.destroy();
    clock.advance(10_000);
    preparer.update(page('m1', 'One'), context, 5);
    await settle();
    expect(calls).toHaveLength(1);
  });
});
