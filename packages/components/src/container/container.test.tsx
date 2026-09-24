import { s } from '@buildr/core';
import { describe, expect, it } from 'vitest';
import { Page } from '../page/definition.ts';
import { createRegistry, Probe, pageWith, problemsOf, render } from '../test-kit.tsx';
import { CONTAINER_WIDTHS, Container } from './definition.ts';
import { containerFixtures } from './fixtures.ts';

const registry = createRegistry({ components: [Page, Container, Probe] });

describe('buildr/container', () => {
  it('defaults to the large width', async () => {
    const { html } = await render(registry, pageWith({ type: 'buildr/container' }));
    expect(html).toContain('<div class="bc-container b-');
    expect(html).toContain('data-width="lg"');
  });

  it.each(CONTAINER_WIDTHS)('supports the %s width', async (width) => {
    const { html } = await render(
      registry,
      pageWith({ type: 'buildr/container', props: { width: s(width) } }),
    );
    expect(html).toContain(`data-width="${width}"`);
  });

  it('renders its children in the default slot, with no wrapper', async () => {
    const { html } = await render(
      registry,
      pageWith({ type: 'buildr/container', children: [{ type: 'test/probe' }] }),
    );
    expect(html).toMatch(
      /<div class="bc-container b-[^"]+" data-width="lg"><p [^>]*>probe<\/p><\/div>/,
    );
  });

  it('has valid, accessible fixtures', () => {
    for (const fixture of containerFixtures) expect(problemsOf(registry, fixture)).toEqual([]);
  });

  it('has serializable metadata', () => {
    expect(JSON.parse(JSON.stringify(Container.meta))).toEqual(Container.meta);
  });
});
