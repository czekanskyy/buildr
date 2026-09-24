import { describe, expect, it } from 'vitest';
import { Page } from '../page/definition.ts';
import { createRegistry, Probe, pageWith, problemsOf, render } from '../test-kit.tsx';
import { Grid } from './definition.ts';
import { gridFixtures } from './fixtures.ts';

const registry = createRegistry({ components: [Page, Grid, Probe] });

describe('buildr/grid', () => {
  it('renders one div with the root attributes and its cells', async () => {
    const { html } = await render(
      registry,
      pageWith({ type: 'buildr/grid', children: [{ type: 'test/probe' }, { type: 'test/probe' }] }),
    );
    expect(html).toMatch(
      /<div class="bc-grid b-[^"]+"><p [^>]*>probe<\/p><p [^>]*>probe<\/p><\/div>/,
    );
  });

  it('compiles responsive columns: 3, then 2 on tablet, then 1 on mobile', async () => {
    const fixture = gridFixtures.find((f) => f.id === 'grid-responsive');
    const { html, diagnostics } = await render(registry, pageWith(fixture?.tree as never));
    expect(diagnostics).toEqual([]);
    const columns = [
      ...html.matchAll(/grid-template-columns: repeat\((\d), minmax\(0, 1fr\)\)/g),
    ].map((m) => m[1]);
    expect(columns).toEqual(['3', '2', '1']);
  });

  it('spans a cell over several columns through the child’s own style', async () => {
    const fixture = gridFixtures.find((f) => f.id === 'grid-spans');
    const { html, diagnostics } = await render(registry, pageWith(fixture?.tree as never));
    expect(diagnostics).toEqual([]);
    expect(html).toContain('grid-column: span 2');
  });

  it('names a group only when it has a name', async () => {
    const plain = await render(registry, pageWith({ type: 'buildr/grid' }));
    expect(plain.html).not.toContain('role=');
  });

  it('has valid, accessible fixtures', () => {
    for (const fixture of gridFixtures) expect(problemsOf(registry, fixture)).toEqual([]);
  });

  it('has serializable metadata and a layout-following axis', () => {
    expect(JSON.parse(JSON.stringify(Grid.meta))).toEqual(Grid.meta);
    expect(Grid.meta.slots?.['default']?.axis).toBe('auto');
  });
});
