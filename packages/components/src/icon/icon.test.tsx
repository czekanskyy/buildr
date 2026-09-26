import { s } from '@next-buildr/core';
import { describe, expect, it } from 'vitest';
import { Page } from '../page/definition.ts';
import { Stack } from '../stack/definition.ts';
import { createRegistry, pageWith, problemsOf, render } from '../test-kit.tsx';
import { ICON_SIZES, IconComponent } from './definition.ts';
import { iconFixtures } from './fixtures.ts';

const registry = createRegistry({ components: [Page, Stack, IconComponent] });
const icon = (props: Record<string, unknown> = {}) =>
  pageWith({ type: 'buildr/icon', props: props as never });
const svg = (html: string) => /<svg [^>]*>/.exec(html)?.[0] ?? '';

describe('buildr/icon', () => {
  it('is drawn on the server as one svg with the root attributes, decorative by default', async () => {
    const { html, diagnostics } = await render(registry, icon({ name: s('heart') }));
    expect(diagnostics).toEqual([]);
    expect(svg(html)).toContain('class="bc-icon b-');
    expect(svg(html)).toContain('aria-hidden="true"');
    expect(svg(html)).not.toContain('role=');
    expect(html).toContain('<path d=');
    expect(html).not.toContain('<script');
  });

  it('is named when it has a label', async () => {
    const { html } = await render(registry, icon({ name: s('circle-alert'), label: s('Warning') }));
    expect(svg(html)).toContain('role="img"');
    expect(svg(html)).toContain('aria-label="Warning"');
    expect(svg(html)).not.toContain('aria-hidden');
  });

  it.each(ICON_SIZES)('supports the %s size', async (size) => {
    const { html } = await render(registry, icon({ name: s('heart'), size: s(size) }));
    expect(svg(html)).toContain(`data-size="${size}"`);
  });

  it('falls back to the medium size', async () => {
    const { html } = await render(registry, icon({ name: s('heart'), size: s('huge') }));
    expect(svg(html)).toContain('data-size="md"');
  });

  it.each(['nope', '', '__proto__', 'constructor'])(
    'renders nothing for the icon %j',
    async (name) => {
      const { html } = await render(registry, icon({ name: s(name) }));
      expect(html).not.toContain('<svg');
    },
  );

  it('has valid, accessible fixtures', () => {
    for (const fixture of iconFixtures) expect(problemsOf(registry, fixture)).toEqual([]);
  });

  it('has serializable metadata', () => {
    expect(JSON.parse(JSON.stringify(IconComponent.meta))).toEqual(IconComponent.meta);
  });
});
