import { createMemoryDataSource, s } from '@next-buildr/core';
import { describe, expect, it } from 'vitest';
import { Container } from '../container/definition.ts';
import { FIXTURE_WIDTHS } from '../fixtures.ts';
import { Page } from '../page/definition.ts';
import { createRegistry, Probe, pageWith, problemsOf, render } from '../test-kit.tsx';
import { SECTION_ELEMENTS, Section } from './definition.ts';
import { sectionFixtures } from './fixtures.ts';

const registry = createRegistry({ components: [Page, Section, Container, Probe] });
const inPage = (props: Record<string, unknown>, children: unknown[] = []) =>
  pageWith({ type: 'buildr/section', props: props as never, children: children as never });

describe('buildr/section', () => {
  it('renders the chosen element with the root attributes, once', async () => {
    const { html } = await render(registry, inPage({ as: s('article'), container: s('md') }));
    expect(html).toContain('<article class="bc-section b-');
    expect(html).toContain('data-container="md"');
    expect(html.match(/<article/g)).toHaveLength(1);
  });

  it.each(SECTION_ELEMENTS)('supports %s', async (as) => {
    const { html } = await render(registry, inPage({ as: s(as) }));
    expect(html).toMatch(new RegExp(`<${as} class="bc-section `));
  });

  it('never renders an element outside the allowlist', async () => {
    const { html } = await render(registry, inPage({ as: s('script') }));
    expect(html).not.toContain('<script');
    expect(html).toContain('<section class="bc-section');
  });

  it('names a landmark from ariaLabel', async () => {
    const named = await render(registry, inPage({ ariaLabel: s('Team') }));
    expect(named.html).toContain('aria-label="Team"');
    const unnamed = await render(registry, inPage({}));
    expect(unnamed.html).not.toContain('aria-label');
  });

  it('draws a bound background image behind its content, decorative', async () => {
    const data = createMemoryDataSource({
      media: { m1: { id: 'm1', url: '/hero.jpg', alt: 'A hero', mimeType: 'image/jpeg' } },
    });
    const { html } = await render(
      registry,
      inPage({ backgroundImage: s({ source: 'x', collection: 'media', id: 'm1' }) }, [
        { type: 'test/probe' },
      ]),
      data,
    );
    expect(html).toMatch(/<img [^>]*class="bc-section__background"[^>]*>/);
    expect(html).toMatch(/<img [^>]*src="\/hero\.jpg"[^>]*alt=""/);
    expect(html.indexOf('bc-section__background')).toBeLessThan(html.indexOf('>probe<'));
  });

  it('draws no background without an image', async () => {
    const { html } = await render(registry, inPage({}));
    expect(html).not.toContain('bc-section__background');
  });

  it('renders its children in the default slot', async () => {
    const { html } = await render(registry, inPage({}, [{ type: 'test/probe' }]));
    expect(html).toContain('>probe<');
  });

  it('has fixtures for three widths that are valid and accessible', () => {
    expect(FIXTURE_WIDTHS).toEqual([1280, 768, 375]);
    for (const fixture of sectionFixtures) {
      expect(problemsOf(registry, fixture)).toEqual([]);
    }
  });

  it('compiles the breakpoint overrides of its fixtures without diagnostics', async () => {
    const fixture = sectionFixtures.find((f) => f.id === 'section-widths');
    const { html, diagnostics } = await render(registry, pageWith(fixture?.tree as never));
    expect(diagnostics).toEqual([]);
    expect(html).toContain('@media');
  });

  it('has complete, serializable metadata', () => {
    const { meta } = Section;
    expect(meta.a11y?.landmark).toBe(true);
    expect(meta.props['backgroundImage']?.kind).toBe('media');
    expect(JSON.parse(JSON.stringify(meta))).toEqual(meta);
  });
});
