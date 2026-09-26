import { runA11y, s } from '@next-buildr/core';
import { describe, expect, it } from 'vitest';
import { Page } from '../page/definition.ts';
import { createRegistry, pageWith, problemsOf, render } from '../test-kit.tsx';
import { Pagination } from './definition.ts';
import { paginationFixtures } from './fixtures.ts';
import { clampInt, type PageItem, pageItems } from './pages.ts';
import { PaginationView } from './view.tsx';

const registry = createRegistry({ components: [Page, Pagination] });
const pagination = (props: Record<string, unknown>) =>
  pageWith({ type: 'buildr/pagination', props: props as never });
const flat = (items: PageItem[]) => items.map((i) => (i.kind === 'gap' ? '…' : String(i.page)));

describe('pageItems', () => {
  it.each([
    [1, 1, ['1']],
    [1, 3, ['1', '2', '3']],
    [3, 5, ['1', '2', '3', '4', '5']],
    [1, 12, ['1', '2', '…', '12']],
    [5, 12, ['1', '…', '4', '5', '6', '…', '12']],
    [12, 12, ['1', '…', '11', '12']],
    [3, 12, ['1', '2', '3', '4', '…', '12']],
    [10, 12, ['1', '…', '9', '10', '11', '12']],
    [1, 0, []],
  ])('page %i of %i shows %j', (page, total, expected) => {
    expect(flat(pageItems(page, total))).toEqual(expected);
  });

  it('never repeats or reorders a page, and only names real pages', () => {
    for (let total = 0; total <= 30; total++) {
      for (let page = 0; page <= total + 2; page++) {
        const pages = pageItems(page, total).flatMap((i) => (i.kind === 'page' ? [i.page] : []));
        expect(pages).toEqual([...new Set(pages)].sort((a, b) => a - b));
        expect(pages.every((n) => n >= 1 && n <= total)).toBe(true);
      }
    }
  });

  it('survives garbage', () => {
    for (const bad of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      -5,
      1.5,
      '3' as never,
      null as never,
    ]) {
      expect(() => pageItems(bad, bad)).not.toThrow();
    }
    expect(pageItems(1, Number.POSITIVE_INFINITY).length).toBeLessThanOrEqual(5);
  });

  it('clamps whole numbers', () => {
    expect(clampInt(2.9, 1, 5, 1)).toBe(2);
    expect(clampInt(99, 1, 5, 1)).toBe(5);
    expect(clampInt(-1, 1, 5, 1)).toBe(1);
    expect(clampInt('x', 1, 5, 3)).toBe(3);
    expect(clampInt(Number.NaN, 1, 5, 3)).toBe(3);
  });
});

describe('buildr/pagination', () => {
  it('is a labelled nav of page links, the current one marked', async () => {
    const { html, diagnostics } = await render(
      registry,
      pagination({ page: s(5), totalPages: s(12), hrefPattern: s('/blog?page={page}') }),
    );
    expect(diagnostics).toEqual([]);
    expect(html).toMatch(/<nav [^>]*aria-label="Pagination"/);
    expect(html).toContain('<ul class="bc-pagination__list">');
    const current = [...html.matchAll(/<a [^>]*aria-current="page"[^>]*>(\d+)<\/a>/g)].map(
      (m) => m[1],
    );
    expect(current).toEqual(['5']);
    for (const n of [4, 5, 6, 12, 1]) expect(html).toContain(`href="/blog?page=${n}"`);
    expect(html).toContain('aria-label="Previous page"');
    expect(html).toContain('aria-label="Next page"');
    expect(html).toContain('aria-hidden="true" class="bc-pagination__gap"');
  });

  it('has no previous link on the first page and no next link on the last', async () => {
    const first = (await render(registry, pagination({ page: s(1), totalPages: s(3) }))).html;
    expect(first).not.toContain('Previous page');
    expect(first).toContain('Next page');
    const last = (await render(registry, pagination({ page: s(3), totalPages: s(3) }))).html;
    expect(last).toContain('Previous page');
    expect(last).not.toContain('Next page');
  });

  it.each([
    [0, 5, 1],
    [-3, 5, 1],
    [99, 5, 5],
    [2.7, 5, 2],
  ])('keeps page %d of %d within bounds: current is %d', async (page, total, expected) => {
    const { html } = await render(registry, pagination({ page: s(page), totalPages: s(total) }));
    const current = [...html.matchAll(/aria-current="page"[^>]*>(\d+)</g)].map((m) => Number(m[1]));
    expect(current).toEqual([expected]);
  });

  it.each([[1], [0]])('renders nothing for %d page(s) on a published page', async (total) => {
    const { html } = await render(registry, pagination({ totalPages: s(total) }));
    expect(html).not.toContain('<nav');
  });

  it('still renders for a single page in the editor’s canvas, so it can be selected', () => {
    const view = (mode: 'canvas' | 'production') =>
      PaginationView({
        props: { page: 1, totalPages: 1, hrefPattern: '?page={page}', ariaLabel: '' } as never,
        root: { className: 'bc-pagination b-x' },
        slots: {},
        node: { id: 'x', type: 'buildr/pagination' },
        env: { mode, locale: 'en', messages: {} },
      });
    expect(view('production')).toBeNull();
    expect(view('canvas')).not.toBeNull();
  });

  it('is named by ariaLabel when there is one, else by the built-in message for the locale', () => {
    const label = (locale: string, ariaLabel = '') =>
      (
        PaginationView({
          props: { page: 1, totalPages: 3, hrefPattern: '?page={page}', ariaLabel } as never,
          root: { className: 'bc-pagination b-x' },
          slots: {},
          node: { id: 'x', type: 'buildr/pagination' },
          env: { mode: 'production', locale, messages: {} },
        }) as unknown as { props: Record<string, unknown> }
      ).props['aria-label'];
    expect(label('en')).toBe('Pagination');
    expect(label('pl')).toBe('Paginacja');
    expect(label('en', 'Blog pages')).toBe('Blog pages');
  });

  it.each(['javascript:alert({page})', 'data:text/html,{page}', 'java\tscript:{page}'])(
    'never links to an unsafe pattern: %j',
    async (pattern) => {
      const { html } = await render(
        registry,
        pagination({ page: s(2), totalPages: s(4), hrefPattern: s(pattern) }),
      );
      expect(html).not.toContain('javascript');
      expect(html).not.toContain('data:');
    },
  );

  it('binds its page and page count', async () => {
    const { html } = await render(
      registry,
      pagination({
        page: { kind: 'binding', path: 'list.page' },
        totalPages: { kind: 'binding', path: 'list.pages' },
      }),
      undefined,
      { list: { page: 2, pages: 4 } },
    );
    expect(html).toMatch(/aria-current="page"[^>]*>2</);
    expect(html).toContain('>4</a>');
  });

  it('is a navigation landmark with a name, so landmark-unique is satisfied', () => {
    expect(Pagination.meta.a11y?.landmark).toBe(true);
    const ids = runA11y(pagination({ page: s(1), totalPages: s(3) }), registry.meta).map(
      (i) => i.ruleId,
    );
    expect(ids).not.toContain('landmark-unique');
  });

  it('has valid, accessible fixtures and serializable metadata', () => {
    for (const f of paginationFixtures) expect(problemsOf(registry, f)).toEqual([]);
    expect(JSON.parse(JSON.stringify(Pagination.meta))).toEqual(Pagination.meta);
  });
});
