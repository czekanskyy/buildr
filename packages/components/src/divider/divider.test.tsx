import { s } from '@next-buildr/core';
import { describe, expect, it } from 'vitest';
import { Page } from '../page/definition.ts';
import { createRegistry, pageWith, problemsOf, render } from '../test-kit.tsx';
import { Divider } from './definition.ts';
import { dividerFixtures } from './fixtures.ts';

const registry = createRegistry({ components: [Page, Divider] });

describe('buildr/divider', () => {
  it('renders an hr with the root attributes', async () => {
    const { html } = await render(registry, pageWith({ type: 'buildr/divider' }));
    expect(html).toMatch(/<hr class="bc-divider b-[^"]+"\/>/);
  });

  it('can be decorative', async () => {
    const { html } = await render(
      registry,
      pageWith({ type: 'buildr/divider', props: { decorative: s(true) } as never }),
    );
    expect(html).toContain('role="presentation"');
  });

  it('has valid fixtures and serializable metadata', async () => {
    for (const fixture of dividerFixtures) {
      expect(problemsOf(registry, fixture)).toEqual([]);
      const { diagnostics } = await render(registry, pageWith(fixture.tree as never));
      expect(diagnostics, fixture.id).toEqual([]);
    }
    expect(JSON.parse(JSON.stringify(Divider.meta))).toEqual(Divider.meta);
  });
});
