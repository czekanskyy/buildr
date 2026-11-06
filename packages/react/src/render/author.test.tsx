import { createMemoryDataSource, defaultTheme, type PageNode, s } from '@next-buildr/core';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { defineComponent } from '../define/define-component.ts';
import { createRegistry } from '../define/registry.ts';
import { renderDocument } from '../server/render-document.tsx';
import { normalizeCapabilities } from './capabilities.ts';
import { dataContext, doc, node, options, Page, platform, registry } from './render.test-kit.tsx';
import { renderTree } from './render-tree.ts';
import { buildRootAttributes } from './root-attrs.ts';

const html = (element: ReactNode) => renderToStaticMarkup(<>{element}</>);

const authored = (): PageNode =>
  node(1, 'buildr/text', { text: s('Hi') }, {
    classes: ['hero', 'wide'],
    attributes: { 'data-track': 'cta', role: 'note', onclick: 'alert(1)' },
    customCss: '& { color: red }',
  } as never);

const document_ = () => doc([authored()]);

describe('author attributes (ADR-026)', () => {
  it('renders nothing of the author fields without the capability', () => {
    for (const capabilities of [
      undefined,
      {},
      { authorCode: false },
      { authorCode: 'yes' as never },
    ]) {
      const out = html(
        renderTree(document_(), options(capabilities === undefined ? {} : { capabilities })),
      );
      expect(out).toContain('<p class="bc-text b-node000001">Hi</p>');
      expect(out).not.toContain('hero');
      expect(out).not.toContain('data-track');
    }
  });

  it('adds the classes and the allowed attributes when authorCode is true, never an on* handler', () => {
    const out = html(renderTree(document_(), options({ capabilities: { authorCode: true } })));
    expect(out).toContain('class="bc-text b-node000001 hero wide"');
    expect(out).toContain('data-track="cta"');
    expect(out).not.toContain('onclick');
  });

  it('does not let an author id or class replace the anchor or the generated class', () => {
    const n = {
      ...node(1, 'buildr/text', {}),
      anchor: 'top',
      attributes: { id: 'other' },
    } as PageNode;
    const root = buildRootAttributes(n, undefined, { authorCode: true });
    expect(root.id).toBe('top');
    expect(root.className).toContain('b-node000001');
  });

  it('normalizes capabilities fail-closed', () => {
    expect(normalizeCapabilities(undefined)).toEqual({});
    expect(normalizeCapabilities(null)).toEqual({});
    expect(normalizeCapabilities({ authorCode: 1 as never })).toEqual({});
    expect(normalizeCapabilities({ authorCode: true })).toEqual({ authorCode: true });
  });

  it('normalizes the host lists fail-closed', () => {
    expect(
      normalizeCapabilities({
        externalMediaHosts: [' CDN.Example.com ', 7 as never, '', 'cdn.example.com', 'b.io'],
        iframeHosts: [],
      }),
    ).toEqual({ externalMediaHosts: ['cdn.example.com', 'b.io'], iframeHosts: [] });
    expect(normalizeCapabilities({ iframeHosts: 'evil.com' as never })).toEqual({
      iframeHosts: [],
    });
    expect(normalizeCapabilities({ authorCode: 'yes' as never })).toEqual({});
    const many = Array.from({ length: 500 }, (_, i) => `h${i}.example.com`);
    expect(normalizeCapabilities({ externalMediaHosts: many }).externalMediaHosts).toHaveLength(
      200,
    );
    expect(normalizeCapabilities({ iframeHosts: ['a'.repeat(300)] }).iframeHosts).toEqual([]);
  });

  it('forwards the host lists into the render env of renderTree and renderDocument', async () => {
    const Probe = defineComponent({
      type: 'test/caps',
      version: 1,
      label: 'Caps',
      category: 'content',
      contentCategories: ['flow'],
      styles: { groups: [] },
      runtime: 'shared',
      props: {},
      render: ({ env, root }) => (
        <p {...root} data-caps={JSON.stringify(env.capabilities ?? null)} />
      ),
    });
    const reg = createRegistry({ components: [Page, Probe] });
    const d = doc([node(1, 'test/caps', {})]);
    const caps = { externalMediaHosts: ['CDN.example.com'], iframeHosts: [] as string[] };
    const expected =
      '{&quot;externalMediaHosts&quot;:[&quot;cdn.example.com&quot;],&quot;iframeHosts&quot;:[]}';

    const tree = html(renderTree(d, options({ registry: reg, capabilities: caps })));
    expect(tree).toContain(`data-caps="${expected}"`);
    const none = html(renderTree(d, options({ registry: reg })));
    expect(none).toContain('data-caps="null"');

    const server = await renderDocument(d, {
      registry: reg,
      theme: defaultTheme,
      dataSource: createMemoryDataSource(),
      context: dataContext(),
      platform,
      capabilities: caps,
    });
    expect(html(server.element)).toContain(`data-caps="${expected}"`);
  });

  it('renderDocument leaves author attributes and custom CSS out by default and renders them when enabled', async () => {
    const run = (capabilities?: { authorCode?: boolean }) =>
      renderDocument(document_(), {
        registry,
        theme: defaultTheme,
        dataSource: createMemoryDataSource(),
        context: dataContext(),
        platform,
        ...(capabilities !== undefined ? { capabilities } : {}),
      });
    const off = html((await run()).element);
    expect(off).not.toContain('hero');
    expect(off).not.toContain('data-track');
    expect(off).not.toContain('buildr.custom');
    expect(off).not.toContain('color: red');

    const on = html((await run({ authorCode: true })).element);
    expect(on).toContain('hero');
    expect(on).toContain('data-track="cta"');
    expect(on).toContain('buildr.custom');
    expect(on).toContain('color: red');
  });
});
