import {
  canInsert,
  createIndex,
  createMemoryDataSource,
  type DataContext,
  defaultTheme,
  runA11y,
  type TemplateDefinition,
  validateDocument,
} from '@buildr/core';
import { doc } from '@buildr/test-utils';
import { describe, expect, it } from 'vitest';
import { render } from '../test-kit.tsx';
import { contentTemplates, marketingTemplates } from './index.ts';
import { templateSampleCollections, templateSampleScopes } from './sample-data.ts';
import { documentOf, templateRegistry as registry } from './templates.test-kit.tsx';

const byId = (id: string) => contentTemplates.find((t) => t.id === id) as TemplateDefinition;
const dataSource = () => createMemoryDataSource({ collections: templateSampleCollections });
const renderTemplate = (id: string, scopes: DataContext['scopes'] = templateSampleScopes) =>
  render(registry, documentOf(byId(id)).document, dataSource(), scopes);

// PostHeader, BlogListing and ProductHero are the page's headline.
const HEADLINES = ['buildr/post-header', 'buildr/blog-listing', 'buildr/product-hero'];

describe('content templates', () => {
  it('are the seven blog and product ones, with their own categories', () => {
    expect(contentTemplates.map((t) => [t.id, t.category])).toEqual([
      ['buildr/post-header', 'blog'],
      ['buildr/post-content', 'blog'],
      ['buildr/author-box', 'blog'],
      ['buildr/post-card', 'blog'],
      ['buildr/blog-listing', 'blog'],
      ['buildr/product-hero', 'commerce'],
      ['buildr/product-details', 'commerce'],
    ]);
    const all = [...marketingTemplates, ...contentTemplates].map((t) => t.id);
    expect(new Set(all).size).toBe(all.length);
  });

  describe.each(contentTemplates.map((t) => ({ id: t.id, template: t })))(
    '$id',
    ({ id, template }) => {
      const config = HEADLINES.includes(id) ? { expectH1: 'document' as const } : {};

      it('makes a valid document', () => {
        const { document } = documentOf(template);
        const result = validateDocument(document, { registry: registry.meta, theme: defaultTheme });
        expect(result.issues).toEqual([]);
      });

      it('has no accessibility errors', () => {
        const { document } = documentOf(template);
        const issues = runA11y(document, registry.meta, { theme: defaultTheme, config });
        expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
      });

      it('can be inserted into a page', () => {
        const { fragment } = documentOf(template);
        const empty = doc({ type: 'buildr/page' });
        const result = canInsert(
          empty,
          createIndex(empty),
          registry.meta,
          { parentId: empty.root, slot: 'default' },
          fragment,
        );
        expect(result.ok).toBe(true);
      });

      it('renders against sample data without a diagnostic', async () => {
        // A card binds to `item`, so it only has data inside a loop: the listing is where it is rendered.
        const { diagnostics } = await renderTemplate(
          id === 'buildr/post-card' ? 'buildr/blog-listing' : id,
        );
        expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
        expect(diagnostics).toEqual([]);
      });

      it('renders without data too, falling back instead of failing', async () => {
        const { html } = await render(registry, documentOf(template).document, dataSource(), {});
        expect(html).toContain('bc-page');
      });

      it('has a small SVG thumbnail', () => {
        expect(template.thumbnail).toMatch(/^data:image\/svg\+xml,%3Csvg/);
      });
    },
  );

  describe('the post', () => {
    it('shows its title as the H1, its date formatted, and its featured image', async () => {
      const { html } = await renderTemplate('buildr/post-header');
      expect(html).toMatch(/<h1[^>]*>Building pages from data<\/h1>/);
      expect(html).toContain('March 14, 2026');
      expect(html).toContain('src="/media/desk.jpg"');
      expect(html).toContain('alt="A desk with a laptop"');
    });

    it('falls back to a title when the post has none', async () => {
      const { html } = await renderTemplate('buildr/post-header', { post: {} });
      expect(html).toContain('Untitled');
    });

    it('shows its article as rich text', async () => {
      const { html } = await renderTemplate('buildr/post-content');
      expect(html).toContain('The first paragraph of the article.');
      expect(html).toContain('The second paragraph of the article.');
      expect(html).toContain('bc-rich-text');
    });

    it('names its author, with a picture, a job title and a bio, in a labelled aside', async () => {
      const { html } = await renderTemplate('buildr/author-box');
      expect(html).toMatch(/<aside[^>]*aria-label="About the author"/);
      expect(html).toContain('Ada Example');
      expect(html).toContain('Editor');
      expect(html).toContain('Writes about how sites are made.');
      expect(html).toContain('src="/media/ada.jpg"');
    });
  });

  describe('the listing', () => {
    const titles = (html: string) =>
      [...html.matchAll(/<h2[^>]*>(Post number \d+)<\/h2>/g)].map((m) => m[1]);

    it('lists the newest posts first, six to a page, each a linked card', async () => {
      const { html } = await renderTemplate('buildr/blog-listing');
      expect(titles(html)).toEqual([1, 2, 3, 4, 5, 6].map((n) => `Post number ${n}`));
      expect(html).toContain('href="/blog/post-1"');
      expect(html).toContain('A short summary of post 1.');
      expect(html).toContain('Mar 20, 2026');
      expect(html.match(/bc-card__link/g)?.length).toBe(6);
    });

    it('takes the page from the route, and shows the rest', async () => {
      const { html } = await renderTemplate('buildr/blog-listing', {
        ...templateSampleScopes,
        route: { path: '/blog', params: { page: '2' }, locale: 'en' },
      });
      expect(titles(html)).toEqual(['Post number 7', 'Post number 8']);
    });

    it('has page links that follow the loop: two pages, the current one marked', async () => {
      const { html } = await renderTemplate('buildr/blog-listing');
      expect(html).toMatch(/<nav[^>]*>/);
      expect(html).toContain('aria-current="page"');
      expect(html).toContain('href="?page=2"');
    });

    it('says so when there are no posts', async () => {
      const result = await render(
        registry,
        documentOf(byId('buildr/blog-listing')).document,
        createMemoryDataSource({ collections: { posts: [] } }),
        templateSampleScopes,
      );
      expect(result.html).toContain('No posts yet.');
    });

    it('lays its cards out in three columns, two on tablet, one on mobile', async () => {
      const { html } = await renderTemplate('buildr/blog-listing');
      expect(html).toContain('@media (max-width: 1023.98px)');
      expect(html).toContain('@media (max-width: 767.98px)');
    });
  });

  describe('the product', () => {
    it('shows its title, its price as money, its summary and a buy button', async () => {
      const { html } = await renderTemplate('buildr/product-hero');
      expect(html).toMatch(/<h1[^>]*>Desk lamp<\/h1>/);
      expect(html).toContain('$49.50');
      expect(html).toContain('A lamp that lights a desk and nothing else.');
      expect(html).toContain('href="https://shop.example.com/desk-lamp"');
      expect(html).toContain('Buy now');
    });

    it('loops over every image of the product', async () => {
      const { html } = await renderTemplate('buildr/product-hero');
      expect(html).toContain('src="/media/lamp-1.jpg"');
      expect(html).toContain('src="/media/lamp-2.jpg"');
    });

    it('drops the buy link when the product has an unsafe one', async () => {
      const { html } = await renderTemplate('buildr/product-hero', {
        product: { ...(templateSampleScopes['product'] as object), buyUrl: 'javascript:alert(1)' },
      });
      expect(html).not.toContain('javascript:');
    });

    it('shows its description and each attribute as a name and a value', async () => {
      const { html } = await renderTemplate('buildr/product-details');
      expect(html).toContain('Made of metal, with a warm light.');
      for (const [name, value] of [
        ['Material', 'Steel'],
        ['Height', '45 cm'],
        ['Weight', '1.2 kg'],
      ]) {
        expect(html).toContain(name);
        expect(html).toContain(value);
      }
      expect(html).toMatch(/<h2[^>]*>Details<\/h2>/);
    });
  });
});
