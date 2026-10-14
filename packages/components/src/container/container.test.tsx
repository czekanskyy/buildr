import { readFileSync } from 'node:fs';
import {
  createMemoryDataSource,
  runA11y,
  s,
  type TreeNode,
  validateDocument,
} from '@next-buildr/core';
import { doc } from '@next-buildr/test-utils';
import { describe, expect, it } from 'vitest';
import { imageFixtureMedia } from '../image/fixtures.ts';
import { Page } from '../page/definition.ts';
import { createRegistry, Probe, render } from '../test-kit.tsx';
import { defaultTheme } from '../theme.ts';
import {
  CONTAINER_DISPLAYS,
  CONTAINER_ELEMENTS,
  CONTAINER_ROLES,
  CONTAINER_WIDTHS,
  Container,
} from './definition.ts';
import { containerFixtures } from './fixtures.ts';

const registry = createRegistry({ components: [Page, Container, Probe] });

/** A document at the current container version (the shared `pageWith` stamps every type at 1). */
const inPage = (tree: TreeNode) =>
  doc(
    { type: 'buildr/page', children: [tree as never] },
    { components: { 'buildr/container': Container.meta.version } },
  );

const container = (props: Record<string, unknown> = {}, children: TreeNode[] = []): TreeNode => ({
  type: 'buildr/container',
  props: props as never,
  children,
});

/** Structural and accessibility errors of a fixture against the registry. Empty is the goal. */
function problems(tree: TreeNode): string[] {
  const document = inPage(tree);
  const validated = validateDocument(document, { registry: registry.meta, theme: defaultTheme });
  const a11y = runA11y(document, registry.meta, { theme: defaultTheme });
  return [
    ...validated.issues.map((i) => `${i.code} ${i.message}`),
    ...a11y.filter((i) => i.severity === 'error').map((i) => `${i.ruleId} ${i.message}`),
  ];
}

describe('buildr/container', () => {
  it('is a flex column limited to the large width by default', async () => {
    const { html } = await render(registry, inPage(container()));
    expect(html).toContain('<div class="bc-container b-');
    expect(html).toContain('data-display="flex"');
    expect(html).toContain('data-width="lg"');
    expect(html).not.toContain('data-bleed');
    expect(html).not.toContain('data-has-background');
    expect(html).not.toContain('role=');
    expect(html).not.toContain('aria-label');
  });

  it.each(CONTAINER_DISPLAYS)('supports the %s display', async (display) => {
    const { html } = await render(registry, inPage(container({ display: s(display) })));
    expect(html).toContain(`data-display="${display}"`);
  });

  it.each(CONTAINER_WIDTHS)('supports the %s width', async (width) => {
    const { html } = await render(registry, inPage(container({ width: s(width) })));
    expect(html).toContain(`data-width="${width}"`);
  });

  it.each(CONTAINER_ELEMENTS)(
    'renders the %s element once, with the root attributes',
    async (as) => {
      const { html } = await render(registry, inPage(container({ as: s(as) })));
      expect(html).toMatch(new RegExp(`<${as} class="bc-container b-`));
      expect(html.match(new RegExp(`<${as}[ >]`, 'g'))?.length).toBeGreaterThanOrEqual(1);
    },
  );

  it('never renders an element outside the allowlist', async () => {
    const { html } = await render(registry, inPage(container({ as: s('script') })));
    expect(html).not.toContain('<script');
    expect(html).toContain('<div class="bc-container');
  });

  it.each(CONTAINER_ROLES.filter((r) => r !== 'none'))('supports the %s role', async (role) => {
    const { html } = await render(
      registry,
      inPage(container({ role: s(role), ariaLabel: s('Things') })),
    );
    expect(html).toContain(`role="${role}"`);
    expect(html).toContain('aria-label="Things"');
  });

  it.each(CONTAINER_ELEMENTS.filter((e) => e !== 'div'))(
    'keeps the role of the %s element: a role prop never overrides it',
    async (as) => {
      const { html } = await render(
        registry,
        inPage(container({ as: s(as), role: s('group'), ariaLabel: s('Things') })),
      );
      expect(html).toMatch(new RegExp(`<${as} class="bc-container[^>]*>`));
      expect(html).not.toContain('role=');
    },
  );

  it('marks a full-width background', async () => {
    const { html } = await render(registry, inPage(container({ bleed: s(true) })));
    expect(html).toContain('data-bleed=""');
  });

  it('renders its children in the default slot, with no wrapper', async () => {
    const { html } = await render(
      registry,
      inPage(container({}, [{ type: 'test/probe' }, { type: 'test/probe' }])),
    );
    expect(html).toMatch(
      /<div class="bc-container b-[^"]+" data-display="flex" data-width="lg"><p [^>]*>probe<\/p><p [^>]*>probe<\/p><\/div>/,
    );
  });

  describe('background image', () => {
    const data = createMemoryDataSource({ media: imageFixtureMedia });
    const ref = s({ source: 'fixtures', collection: 'media', id: 'm1' }) as never;

    it('draws a decorative image behind its content and marks the container', async () => {
      const { html } = await render(
        registry,
        inPage(container({ backgroundImage: ref }, [{ type: 'test/probe' }])),
        data,
      );
      expect(html).toContain('data-has-background=""');
      expect(html).toMatch(/<img [^>]*class="bc-container__background"[^>]*>/);
      expect(html).toMatch(/<img [^>]*src="\/media\/cat\.jpg"[^>]*alt=""/);
      expect(html.indexOf('bc-container__background')).toBeLessThan(html.indexOf('>probe<'));
    });

    it('draws nothing without an image', async () => {
      const { html } = await render(registry, inPage(container()));
      expect(html).not.toContain('bc-container__background');
    });
  });

  it('lets the slot axis follow the computed layout', () => {
    expect(Container.meta.slots?.['default']?.axis).toBe('auto');
  });

  it('compiles the layout of its fixtures, and their breakpoint overrides, without diagnostics', async () => {
    const fixture = containerFixtures.find((f) => f.id === 'container-row-to-column');
    const { html, diagnostics } = await render(registry, inPage(fixture?.tree as never));
    expect(diagnostics).toEqual([]);
    expect(html).toContain('flex-direction: row');
    expect(html).toContain('flex-direction: column');
    expect(html).toContain('@media');
  });

  describe('fixtures', () => {
    it.each(containerFixtures.map((f) => [f.id, f] as const))(
      '%s is valid and accessible',
      (_id, f) => {
        expect(problems(f.tree)).toEqual([]);
      },
    );

    it('has one for every display mode', () => {
      const shown = new Set(
        containerFixtures.map((f) => {
          const display = f.tree.props?.['display'];
          return display?.kind === 'static' ? display.value : 'flex';
        }),
      );
      expect([...shown]).toEqual(expect.arrayContaining([...CONTAINER_DISPLAYS]));
    });
  });

  describe('metadata', () => {
    const { meta } = Container;

    it('is version 2, a landmark that follows `as`, and takes landmark content', () => {
      expect(meta.version).toBe(2);
      expect(meta.a11y).toEqual({ element: 'div', landmark: true });
      expect(meta.contentCategories).toEqual(['flow', 'landmark']);
      expect(meta.styles.groups).toContain('size');
    });

    it('labels the block display as a box and the missing width limit as "No limit"', () => {
      const display = meta.props['display'];
      const width = meta.props['width'];
      expect(display?.kind === 'select' && display.optionLabels?.['block']).toBe('Box');
      expect(display?.kind === 'select' && display.default).toBe('flex');
      expect(width?.kind === 'select' && width.optionLabels?.['none']).toBe('No limit');
      expect(width?.kind === 'select' && width.default).toBe('lg');
    });

    it('keeps the background image prop of the section it replaces', () => {
      const image = meta.props['backgroundImage'];
      expect(image?.kind).toBe('media');
      expect(image?.kind === 'media' && image.accept).toEqual(['image']);
      expect(image?.bindable).toBe(true);
    });

    it('is serializable', () => {
      expect(JSON.parse(JSON.stringify(meta))).toEqual(meta);
    });
  });

  describe('styles', () => {
    const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    );
    /** The declarations of every rule whose selector list contains `selector`, merged in order. */
    const rule = (selector: string): Record<string, string> => {
      const declarations: Record<string, string> = {};
      for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const selectors = (match[1] ?? '').split(',').map((part) => part.trim());
        if (!selectors.includes(selector)) continue;
        for (const d of (match[2] ?? '').matchAll(/([\w-]+)\s*:\s*([^;]+);/g)) {
          declarations[d[1] ?? ''] = (d[2] ?? '').trim();
        }
      }
      return declarations;
    };

    it('keeps the version 1 block rules: full width, centred, limited to the column', () => {
      expect(rule('.bc-container')).toMatchObject({
        width: '100%',
        'margin-inline': 'auto',
        'max-width': 'var(--bc-container-column)',
        '--bc-container-column': 'var(--b-container-lg)',
      });
    });

    it.each(['sm', 'md', 'lg', 'xl'])('keeps the %s column token', (w) => {
      expect(rule(`.bc-container[data-width="${w}"]`)).toEqual({
        '--bc-container-column': `var(--b-container-${w})`,
      });
    });

    it('lifts the width limit, the margin and the centring for `none`', () => {
      expect(rule('.bc-container[data-width="none"]')).toEqual({
        width: 'auto',
        'max-width': 'none',
        'margin-inline': '0',
      });
    });

    it('keeps the column with padding when the background bleeds, and always makes it a stacking context', () => {
      expect(rule('.bc-container[data-bleed]')).toMatchObject({
        position: 'relative',
        isolation: 'isolate',
        width: 'auto',
        'max-width': 'none',
        'margin-inline': '0',
        'padding-inline': 'max(var(--b-space-4), calc((100% - var(--bc-container-column)) / 2))',
      });
      expect(rule('.bc-container[data-bleed][data-width="none"]')).toEqual({
        'padding-inline': '0',
      });
      expect(rule('.bc-container[data-has-background]')).toEqual({
        position: 'relative',
        isolation: 'isolate',
      });
    });

    /** The cascade of `.bc-container` rules for an element with these data attributes. */
    const computed = (attributes: Record<string, string>): Record<string, string> => {
      const matches = (selector: string): boolean => {
        if (!selector.startsWith('.bc-container')) return false;
        const rest = selector.slice('.bc-container'.length);
        if (rest.startsWith('__')) return false;
        for (const part of rest.matchAll(/(:not\()?\[(data-[\w-]+)(?:="([^"]*)")?\]\)?/g)) {
          const present =
            part[2] !== undefined &&
            part[2] in attributes &&
            (part[3] === undefined || attributes[part[2]] === part[3]);
          if (part[1] !== undefined ? present : !present) return false;
        }
        return true;
      };
      const declarations: Record<string, string> = {};
      for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const selectors = (match[1] ?? '').split(',').map((part) => part.trim());
        if (!selectors.some(matches)) continue;
        for (const d of (match[2] ?? '').matchAll(/([\w-]+)\s*:\s*([^;]+);/g)) {
          declarations[d[1] ?? ''] = (d[2] ?? '').trim();
        }
      }
      return declarations;
    };

    it('stacks flex and grid with the default gap', () => {
      for (const display of ['flex', 'inline-flex']) {
        expect(computed({ 'data-display': display, 'data-width': 'none' })).toMatchObject({
          display,
          'flex-direction': 'column',
          gap: 'var(--b-space-4)',
        });
      }
      expect(computed({ 'data-display': 'grid', 'data-width': 'none' })).toMatchObject({
        display: 'grid',
        gap: 'var(--b-space-4)',
      });
    });

    describe('geometry of migrated components, inside constrained row and grid parents', () => {
      // What `.bc-stack` set: a flex column with a gap that may shrink, and no width of its own.
      const stack = computed({ 'data-display': 'flex', 'data-width': 'none' });
      // What `.bc-section` set: a positioned flex column, padded to the column, never forced to shrink.
      const section = computed({ 'data-display': 'flex', 'data-width': 'lg', 'data-bleed': '' });

      it('a stack still shrinks (min-width 0) and sizes automatically, centred by nothing', () => {
        expect(stack).toMatchObject({
          display: 'flex',
          'flex-direction': 'column',
          gap: 'var(--b-space-4)',
          'min-width': '0',
          width: 'auto',
          'max-width': 'none',
          'margin-inline': '0',
        });
        expect(stack).not.toHaveProperty('position');
        expect(stack).not.toHaveProperty('padding-inline');
      });

      it('a section keeps the automatic minimum width, its padding and its stacking context', () => {
        expect(section).not.toHaveProperty('min-width');
        expect(section).toMatchObject({
          display: 'flex',
          'flex-direction': 'column',
          width: 'auto',
          'max-width': 'none',
          'margin-inline': '0',
          position: 'relative',
          isolation: 'isolate',
          'padding-inline': 'max(var(--b-space-4), calc((100% - var(--bc-container-column)) / 2))',
        });
      });

      it('a full-width section has no inline padding', () => {
        const full = computed({
          'data-display': 'flex',
          'data-width': 'none',
          'data-bleed': '',
        });
        expect(full['padding-inline']).toBe('0');
        expect(full).not.toHaveProperty('min-width');
      });

      it('a stored v1 container (block, limited) keeps its width rules and gains no min-width', () => {
        expect(computed({ 'data-display': 'block', 'data-width': 'md' })).toEqual({
          '--bc-container-column': 'var(--b-container-md)',
          width: '100%',
          'margin-inline': 'auto',
          'max-width': 'var(--bc-container-column)',
          display: 'block',
        });
      });
    });

    it('leaves block and inline-block boxes alone', () => {
      expect(rule('.bc-container[data-display="block"]')).toEqual({ display: 'block' });
      expect(rule('.bc-container[data-display="inline-block"]')).toEqual({
        display: 'inline-block',
      });
    });

    it('draws the background image behind the content', () => {
      expect(rule('.bc-container__background')).toMatchObject({
        position: 'absolute',
        inset: '0',
        'z-index': '-1',
        'object-fit': 'cover',
      });
    });
  });
});
