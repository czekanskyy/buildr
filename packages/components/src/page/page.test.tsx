import { describe, expect, it } from 'vitest';
import { Container } from '../container/definition.ts';
import { Section } from '../section/definition.ts';
import { createRegistry, Probe, pageWith, render } from '../test-kit.tsx';
import { Page } from './definition.ts';

const registry = createRegistry({ components: [Page, Section, Container, Probe] });

describe('buildr/page', () => {
  it('is the document root and cannot be inserted, moved, removed or duplicated', () => {
    const { meta } = Page;
    expect(meta.capabilities).toEqual({
      root: true,
      insertable: false,
      draggable: false,
      removable: false,
      duplicable: false,
    });
    expect(meta.props).toEqual({});
    expect(meta.runtime).toBe('shared');
    expect(meta.version).toBe(1);
  });

  it('renders one div with the root attributes and no wrapper', async () => {
    const { html, diagnostics } = await render(
      registry,
      pageWith({ type: 'buildr/section', children: [{ type: 'test/probe' }] }),
    );
    expect(diagnostics).toEqual([]);
    expect(html).toMatch(/<div class="bc-page b-root"><section [^>]*>.*<\/section><\/div>/);
  });

  it('serializes its metadata without functions', () => {
    expect(JSON.parse(JSON.stringify(Page.meta))).toEqual(Page.meta);
  });
});
