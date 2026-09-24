import { type DataContext, type DataSource, defaultTheme, p, s } from '@buildr/core';
import { createRegistry, defineComponent } from '@buildr/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createBuildrConfig } from './config.ts';
import { BuildrPage } from './page.tsx';
import { createNextPlatform } from './platform.tsx';

const base = {
  version: 1,
  category: 'content',
  contentCategories: ['flow'],
  styles: { groups: [] },
} as const;

const Page = defineComponent({
  ...base,
  type: 'buildr/page',
  label: 'Page',
  runtime: 'shared',
  props: {},
  slots: { default: {} },
  capabilities: { root: true },
  render: ({ root, children }) => <main {...root}>{children}</main>,
});
const Heading = defineComponent({
  ...base,
  type: 'test/heading',
  label: 'Heading',
  runtime: 'shared',
  props: { text: p.text({ default: 'Hi' }) },
  render: ({ root, props }) => <h1 {...root}>{props.text}</h1>,
});

const dataSource: DataSource = {
  getMedia: async () => ({}),
  query: async () => {
    throw new Error('not used');
  },
};
const context: DataContext = {
  scopes: {},
  locale: 'en',
  locales: { default: 'en', fallback: true, intl: { en: 'English' } },
  timeZone: 'UTC',
  mode: 'production',
};

const document = (text: string) => ({
  schemaVersion: 1,
  root: 'root',
  nodes: {
    root: { id: 'root', type: 'buildr/page', slots: { default: ['hhhhhhhhh1'] } },
    hhhhhhhhh1: { id: 'hhhhhhhhh1', type: 'test/heading', props: { text: s(text) } },
  },
  components: { 'buildr/page': 1, 'test/heading': 1 },
});

const config = (onError?: (e: unknown) => void) =>
  createBuildrConfig({
    registry: createRegistry({ components: [Page, Heading] }),
    theme: defaultTheme,
    platform: createNextPlatform(),
    dataSource: () => dataSource,
    ...(onError ? { onError } : {}),
  });

describe('BuildrPage', () => {
  it('renders a stored document to HTML with its stylesheet', async () => {
    const element = await BuildrPage({
      config: config(),
      entry: { document: document('Hello'), context },
    });
    const html = renderToStaticMarkup(<>{element}</>);
    expect(html).toContain('<h1');
    expect(html).toContain('>Hello</h1>');
    expect(html).toContain('<style');
  });

  it('wraps top-level sections in boundaries without changing the output', async () => {
    const entry = { document: document('Hello'), context };
    const plain = await BuildrPage({ config: config(), entry, sectionBoundaries: false });
    const wrapped = await BuildrPage({ config: config(), entry, sectionBoundaries: true });
    expect(renderToStaticMarkup(<>{wrapped}</>)).toBe(renderToStaticMarkup(<>{plain}</>));
  });

  it('throws for an unusable document and reports it, unless a fallback is given', async () => {
    const onError = vi.fn();
    const entry = { document: { nonsense: true }, context };
    await expect(BuildrPage({ config: config(onError), entry })).rejects.toThrow(
      /cannot be rendered/,
    );
    expect(onError).toHaveBeenCalled();
    const out = await BuildrPage({ config: config(), entry, fallback: 'fallback' });
    expect(out).toBe('fallback');
  });
});
