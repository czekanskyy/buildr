import { describe, expect, it } from 'vitest';
import { galleryFixtures } from './demo/gallery.ts';
import { renderFixtureToHtml } from './render.ts';

describe('renderFixtureToHtml', () => {
  it.each(galleryFixtures.map((f) => [f.id, f] as const))(
    'renders the %s fixture without diagnostics',
    async (_id, fixture) => {
      const { html, diagnostics } = await renderFixtureToHtml(fixture.document);
      expect(diagnostics).toEqual([]);
      expect(html).toContain('<div class="bc-page');
    },
  );

  it('is deterministic', async () => {
    const [a, b] = await Promise.all(
      [0, 1].map(() => renderFixtureToHtml(galleryFixtures[0]?.document)),
    );
    expect(a?.html).toBe(b?.html);
  });

  it('renders the hello fixture as expected', async () => {
    const { html } = await renderFixtureToHtml(galleryFixtures[0]?.document);
    expect(html).toContain('<h1 class="bc-heading');
    expect(html).toContain('Hello, Buildr');
  });

  it('renders the loop over the gallery data', async () => {
    const fixture = galleryFixtures.find((f) => f.id === 'loop');
    const { html } = await renderFixtureToHtml(fixture?.document);
    for (const title of ['First post', 'Second post', 'Third post']) {
      expect(html).toContain(title);
    }
  });

  it('gives no markup for a document that cannot be rendered', async () => {
    const { html, diagnostics } = await renderFixtureToHtml('nope');
    expect(html).toBe('');
    expect(diagnostics.length).toBeGreaterThan(0);
  });
});
