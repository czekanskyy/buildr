import { readdirSync, readFileSync } from 'node:fs';
import {
  type BuilderDocument,
  createMemoryDataSource,
  type DataContext,
  defaultTheme,
  p,
  s,
} from '@next-buildr/core';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { defineComponent } from '../define/define-component.ts';
import { createRegistry } from '../define/registry.ts';
import {
  dataContext,
  doc,
  ID,
  node,
  Page,
  platform,
  registry,
} from '../render/render.test-kit.tsx';
import { renderDocument } from './render-document.tsx';

const html = (element: ReactNode) => renderToStaticMarkup(<>{element}</>);
const source = createMemoryDataSource();

/** React merges the styles of one precedence into a single tag and lists their hrefs, each once. */
const hrefs = (out: string): string[] =>
  [...out.matchAll(/data-href="([^"]*)"/g)].flatMap((m) => (m[1] ?? '').split(' '));

const run = (input: unknown, overrides: Partial<Parameters<typeof renderDocument>[1]> = {}) =>
  renderDocument(input, {
    registry,
    theme: defaultTheme,
    dataSource: source,
    context: dataContext(),
    platform,
    ...overrides,
  });

const styled = (gap: string) => ({ styles: { base: { layout: { gap } } } }) as { styles: never };

describe('renderDocument', () => {
  it('runs the whole pipeline: styles, then the page', async () => {
    const d = doc([node(1, 'buildr/text', { text: s('Hello') }, styled('1rem'))]);
    const result = await run(d);
    const out = html(result.element);
    expect(out).toContain('<p class="bc-text b-node000001">Hello</p>');
    expect(out).toContain('@layer buildr.nodes');
    expect(out).toContain('.b-node000001 { gap: 1rem; }');
    expect(out).toContain('data-precedence="buildr"');
    // The styles come before the page.
    expect(out.indexOf('<style')).toBeLessThan(out.indexOf('<div class="bc-page'));
    expect(result.diagnostics).toEqual([]);
  });

  it('sends the layer order and the tokens once per page, however many documents there are', async () => {
    const [a, b] = await Promise.all([
      run(doc([node(1, 'buildr/text', {}, styled('1rem'))])),
      run(doc([node(2, 'buildr/text', {}, styled('2rem'))])),
    ]);
    const out = html(
      <>
        {a.element}
        {b.element}
      </>,
    );
    const all = hrefs(out);
    expect(all.filter((h) => h.startsWith('buildr-theme-'))).toHaveLength(1);
    expect(all.filter((h) => !h.startsWith('buildr-theme-'))).toHaveLength(2);
    expect(out.match(/@layer buildr\.reset/g)).toHaveLength(1);
  });

  it('gives the same stylesheet the same href, so React can drop the duplicate', async () => {
    const d = doc([node(1, 'buildr/text', {}, styled('1rem'))]);
    const out = html(
      <>
        {(await run(d)).element}
        {(await run(d)).element}
      </>,
    );
    const all = hrefs(out);
    expect(all).toHaveLength(2);
    expect(new Set(all).size).toBe(2);
    expect(out.match(/@layer buildr.nodes/g)).toHaveLength(1);
  });

  it('prepares media and queries through the data source', async () => {
    const data = createMemoryDataSource({
      media: { m1: { id: 'm1', url: '/cat.png', alt: 'A cat', mimeType: 'image/png' } },
      collections: { posts: [{ title: 'First' }, { title: 'Second' }] },
    });
    const d = doc(
      [
        node(1, 'buildr/image', { image: s({ source: 'x', collection: 'media', id: 'm1' }) }),
        node(
          2,
          'buildr/loop',
          { source: s({ type: 'query', spec: { source: 'posts', limit: 10 } }) },
          { slots: { item: [ID(3)] } },
        ),
        node(3, 'buildr/text', { text: { kind: 'binding', path: 'item.title' } }),
      ],
      {},
      [ID(1), ID(2)],
    );
    const result = await run(d, { dataSource: data });
    const out = html(result.element);
    expect(out).toContain('src="/cat.png" alt="A cat"');
    expect(out).toContain('>First<');
    expect(out).toContain('>Second<');
    expect(result.collectionsUsed).toEqual(['media', 'posts']);
  });

  describe('migration', () => {
    it('migrates component props to the registry versions', async () => {
      const Renamed = defineComponent({
        version: 2,
        category: 'content',
        contentCategories: ['flow'],
        styles: { groups: [] },
        type: 'acme/renamed',
        label: 'Renamed',
        runtime: 'shared',
        props: { title: p.text({ default: '' }) },
        render: ({ props, root }) => <p {...root}>{props.title}</p>,
        migrations: {
          2: (props) => ({ title: (props as never as { label: unknown }).label }) as never,
        },
      });
      const reg = createRegistry({ components: [Page, Renamed] });
      const old = {
        schemaVersion: 1,
        root: 'root',
        components: { 'buildr/page': 1, 'acme/renamed': 1 },
        nodes: {
          root: { id: 'root', type: 'buildr/page', slots: { default: ['node000001'] } },
          node000001: {
            id: 'node000001',
            type: 'acme/renamed',
            props: { label: s('Old prop name') },
          },
        },
      };
      const result = await run(old, { registry: reg });
      expect(html(result.element)).toContain('Old prop name');
      expect(result.readOnlyReasons).toEqual([]);
    });

    it('renders on, but flags the document read-only, when a component is newer than this build', async () => {
      const d: BuilderDocument = {
        ...doc([node(1, 'buildr/text', { text: s('Hi') })]),
        components: { 'buildr/page': 1, 'buildr/text': 9 },
      };
      const result = await run(d);
      expect(result.readOnlyReasons.map((r) => r.code)).toEqual(['component.newer-than-registry']);
      expect(html(result.element)).toContain('Hi');
    });
  });

  describe('a document that cannot be rendered', () => {
    const cases: [string, unknown, string][] = [
      ['not an object', 'nope', 'document.invalid'],
      ['no schema version', { root: 'root' }, 'document.invalid'],
      ['a newer schema version', { schemaVersion: 99 }, 'document.newer-version'],
      ['a broken envelope', { schemaVersion: 1, root: 'root', nodes: 5, components: {} }, ''],
      ['a missing root node', { schemaVersion: 1, root: 'root', nodes: {}, components: {} }, ''],
    ];
    it.each(cases)('is null with the reasons, not a throw: %s', async (_name, input, code) => {
      const result = await run(input);
      expect(result.element).toBeNull();
      expect(result.diagnostics.length).toBeGreaterThan(0);
      if (code !== '') expect(result.diagnostics.map((d) => d.code)).toContain(code);
      expect(result.collectionsUsed).toEqual([]);
    });
  });

  it('reports rendering problems without failing', async () => {
    const d = doc([node(1, 'acme/mystery'), node(2, 'buildr/text', { text: s('still here') })]);
    const result = await run(d);
    expect(html(result.element)).toContain('still here');
    expect(result.diagnostics.map((x) => x.code)).toContain('render.unknown-component');
  });

  it('never imports a use-client module from the server or shared render path', () => {
    for (const dir of ['.', '../render']) {
      const base = new URL(`${dir}/`, import.meta.url);
      for (const file of readdirSync(base).filter(
        (f) => /\.tsx?$/.test(f) && !f.includes('.test'),
      )) {
        const text = readFileSync(new URL(file, base), 'utf8');
        expect(text.trimStart(), file).not.toMatch(/^['"]use client['"]/);
        expect(text, file).not.toMatch(/from ['"][^'"]*\/client\//);
      }
    }
  });

  it('accepts a context it did not build itself', async () => {
    const context: DataContext = {
      ...dataContext({ post: { title: 'From data' } }),
      mode: 'preview',
    };
    const d = doc([node(1, 'buildr/text', { text: { kind: 'binding', path: 'post.title' } })]);
    expect(html((await run(d, { context })).element)).toContain('From data');
  });
});
