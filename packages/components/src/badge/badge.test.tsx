import { s } from '@next-buildr/core';
import { describe, expect, it } from 'vitest';
import { Page } from '../page/definition.ts';
import { Stack } from '../stack/definition.ts';
import { createRegistry, pageWith, problemsOf, render } from '../test-kit.tsx';
import { BADGE_VARIANTS, Badge } from './definition.ts';
import { badgeFixtures } from './fixtures.ts';

const registry = createRegistry({ components: [Page, Stack, Badge] });
const badge = (props: Record<string, unknown> = {}) =>
  pageWith({ type: 'buildr/badge', props: props as never });

describe('buildr/badge', () => {
  it('renders a span with the root attributes and its text', async () => {
    const { html } = await render(registry, badge({ text: s('New') }));
    expect(html).toMatch(/<span class="bc-badge b-[^"]+" data-variant="neutral">New<\/span>/);
  });

  it.each(BADGE_VARIANTS)('supports the %s variant', async (variant) => {
    const { html } = await render(registry, badge({ variant: s(variant) }));
    expect(html).toContain(`data-variant="${variant}"`);
  });

  it('falls back to neutral for an unknown variant', async () => {
    const { html } = await render(registry, badge({ variant: s('x"><script>') }));
    expect(html).toContain('data-variant="neutral"');
    expect(html).not.toContain('<script>');
  });

  it('binds its text', async () => {
    const { html } = await render(
      registry,
      badge({ text: { kind: 'binding', path: 'post.status' } }),
      undefined,
      { post: { status: 'Draft' } },
    );
    expect(html).toContain('>Draft</span>');
  });

  it('has valid fixtures and serializable metadata', () => {
    for (const fixture of badgeFixtures) expect(problemsOf(registry, fixture)).toEqual([]);
    expect(JSON.parse(JSON.stringify(Badge.meta))).toEqual(Badge.meta);
    expect(Badge.meta.editor?.inlineProp).toBe('text');
  });
});
