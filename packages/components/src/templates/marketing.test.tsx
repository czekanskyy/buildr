import {
  canInsert,
  createIndex,
  defaultTheme,
  findLockRoot,
  instantiateTemplate,
  isInsideRegion,
  runA11y,
  type TemplateDefinition,
  validateDocument,
} from '@buildr/core';
import { doc } from '@buildr/test-utils';
import { describe, expect, it } from 'vitest';
import { problemsOf, render } from '../test-kit.tsx';
import { marketingTemplateFixtures } from './fixtures.ts';
import { marketingTemplates } from './index.ts';
import { documentOf, templateRegistry } from './templates.test-kit.tsx';

const registry = templateRegistry;

/** Every (template, variant) pair: `undefined` is the template's own tree. */
const cases = marketingTemplates.flatMap((template) =>
  [undefined, ...Object.keys(template.variants ?? {})].map((variant) => ({
    template,
    variant,
    name: variant === undefined ? template.id : `${template.id} (${variant})`,
  })),
);

// A hero is the page's headline; the other templates sit under the layout's own H1.
const a11yConfig = (template: TemplateDefinition) =>
  template.id === 'buildr/hero' ? { expectH1: 'document' as const } : {};

describe('marketing templates', () => {
  it('are the seven MVP ones, with unique namespaced ids', () => {
    expect(marketingTemplates.map((t) => t.id)).toEqual([
      'buildr/hero',
      'buildr/feature-grid',
      'buildr/cta',
      'buildr/testimonial',
      'buildr/pricing',
      'buildr/faq',
      'buildr/contact',
    ]);
    for (const t of marketingTemplates) {
      expect(t.category).toBe('marketing');
      expect(t.version).toBe(1);
      expect(t.label).not.toBe('');
    }
  });

  it('have a gallery fixture each, for the template and every variant', () => {
    expect(marketingTemplateFixtures.map((f) => f.id)).toEqual([
      'template-hero',
      'template-hero-imageRight',
      'template-hero-centered',
      'template-feature-grid',
      'template-cta',
      'template-testimonial',
      'template-pricing',
      'template-faq',
      'template-contact',
    ]);
    for (const fixture of marketingTemplateFixtures) {
      const problems = problemsOf(registry, fixture).filter((p) => !/heading-order|h1/.test(p));
      expect(problems).toEqual([]);
    }
  });

  it('are known to the registry', () => {
    expect(registry.meta.listTemplates().map((t) => t.id)).toEqual(
      expect.arrayContaining(marketingTemplates.map((t) => t.id)),
    );
  });

  describe.each(cases)('$name', ({ template, variant }) => {
    it('makes a valid document', () => {
      const { document } = documentOf(template, variant);
      const result = validateDocument(document, { registry: registry.meta, theme: defaultTheme });
      expect(result.issues).toEqual([]);
    });

    it('has no accessibility errors', () => {
      const { document } = documentOf(template, variant);
      const issues = runA11y(document, registry.meta, {
        theme: defaultTheme,
        config: a11yConfig(template),
      });
      expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    });

    it('can be inserted into a page', () => {
      const { document, fragment } = documentOf(template, variant);
      const empty = doc({ type: 'buildr/page' });
      const result = canInsert(
        empty,
        createIndex(empty),
        registry.meta,
        { parentId: empty.root, slot: 'default' },
        fragment,
      );
      expect(result.ok).toBe(true);
      expect(document.nodes).toBeDefined();
    });

    it('renders without a diagnostic', async () => {
      const { document } = documentOf(template, variant);
      const { html, diagnostics } = await render(registry, document);
      expect(diagnostics).toEqual([]);
      expect(html).toContain('<section');
    });

    it('stays inside the theme: every token it uses exists', async () => {
      const { document } = documentOf(template, variant);
      const { diagnostics } = await render(registry, document);
      expect(diagnostics.filter((d) => d.code.startsWith('style.'))).toEqual([]);
    });

    it('is not a screenshot: its thumbnail is a small SVG data URI', () => {
      expect(template.thumbnail).toMatch(/^data:image\/svg\+xml,%3Csvg/);
      expect((template.thumbnail ?? '').length).toBeLessThan(3000);
      expect(decodeURIComponent(template.thumbnail ?? '')).not.toMatch(/<script|onload|href=/i);
    });
  });

  it('mint new ids on every instantiation', () => {
    for (const template of marketingTemplates) {
      const a = Object.keys(instantiateTemplate(template).nodes);
      const b = Object.keys(instantiateTemplate(template).nodes);
      expect(a.filter((id) => b.includes(id))).toEqual([]);
    }
  });

  it('lay out for all three breakpoints: multi-column ones give tablet and mobile their own', async () => {
    for (const id of ['buildr/feature-grid', 'buildr/pricing', 'buildr/contact', 'buildr/hero']) {
      const template = marketingTemplates.find((t) => t.id === id) as TemplateDefinition;
      const { document } = documentOf(template);
      const { html } = await render(registry, document);
      expect(html, id).toContain('@media (max-width: 1023.98px)');
      expect(html, id).toContain('@media (max-width: 767.98px)');
    }
  });

  it('give every band the theme rhythm, tighter on a phone', async () => {
    for (const template of marketingTemplates) {
      const { document } = documentOf(template);
      const bands = Object.values(document.nodes).filter((n) => n.type === 'buildr/section');
      expect(bands, template.id).toHaveLength(1);
      const styles = bands[0]?.styles as { base: object; bp: { mobile: object } };
      expect(styles.bp.mobile).toBeDefined();
    }
  });

  describe('the hero', () => {
    const hero = marketingTemplates[0] as TemplateDefinition;

    it('has the two variants of the brief, and rejects an unknown one', () => {
      expect(Object.keys(hero.variants ?? {}).sort()).toEqual(['centered', 'imageRight']);
      expect(() => instantiateTemplate(hero, 'nope')).toThrow(/no variant "nope"/);
    });

    it('puts the picture on the other side in imageRight', () => {
      const order = (variant?: string) => {
        const { document } = documentOf(hero, variant);
        const grid = Object.values(document.nodes).find((n) => n.type === 'buildr/grid');
        return (grid?.slots?.['default'] ?? []).map((id) => document.nodes[id]?.type);
      };
      expect(order()).toEqual(['buildr/image', 'buildr/stack']);
      expect(order('imageRight')).toEqual(['buildr/stack', 'buildr/image']);
    });

    it('has no picture, and centred text, in centered', () => {
      const { document } = documentOf(hero, 'centered');
      expect(Object.values(document.nodes).some((n) => n.type === 'buildr/image')).toBe(false);
    });

    it('is locked, with the buttons left open to editing as the actions region', () => {
      for (const variant of [undefined, 'imageRight', 'centered']) {
        const { document, fragment } = documentOf(hero, variant);
        const index = createIndex(document);
        const root = fragment.roots[0] as string;
        expect(document.nodes[root]?.lock?.structure).toBe(true);
        const actions = Object.values(document.nodes).find((n) => n.region === 'actions');
        expect(actions, String(variant)).toBeDefined();
        const button = document.nodes[actions?.slots?.['default']?.[0] ?? ''];
        expect(findLockRoot(document, index, button?.id ?? '')).toBe(root);
        expect(isInsideRegion(document, index, button?.id ?? '')).toBe(true);
        const heading = Object.values(document.nodes).find((n) => n.type === 'buildr/heading');
        expect(isInsideRegion(document, index, heading?.id ?? '')).toBe(false);
      }
    });

    it('has one level-one heading', () => {
      const { document } = documentOf(hero);
      const levels = Object.values(document.nodes)
        .filter((n) => n.type === 'buildr/heading')
        .map((n) => (n.props?.['level'] as { value: number } | undefined)?.value);
      expect(levels).toEqual([1]);
    });
  });

  describe('the others', () => {
    const byId = (id: string) => marketingTemplates.find((t) => t.id === id) as TemplateDefinition;
    const count = (template: TemplateDefinition, type: string) =>
      Object.values(documentOf(template).document.nodes).filter((n) => n.type === type).length;

    it('give the feature grid six features and the pricing three plans', () => {
      expect(count(byId('buildr/feature-grid'), 'buildr/icon')).toBe(6);
      expect(count(byId('buildr/pricing'), 'buildr/card')).toBe(3);
    });

    it('build the faq from native disclosures, the first open', async () => {
      const { document } = documentOf(byId('buildr/faq'));
      const { html } = await render(registry, document);
      expect(count(byId('buildr/faq'), 'buildr/accordion-item')).toBe(4);
      expect(html.match(/<details/g)).toHaveLength(4);
      expect(html.match(/<details[^>]* open=""/g)).toHaveLength(1);
    });

    it('build the contact form from fields the server can check', async () => {
      const { deriveFormSchema } = await import('@buildr/core');
      const { document } = documentOf(byId('buildr/contact'));
      const formId = Object.values(document.nodes).find((n) => n.type === 'buildr/form')?.id ?? '';
      const { schema, diagnostics } = deriveFormSchema(document, registry.meta, formId);
      expect(diagnostics).toEqual([]);
      expect(schema.fields.map((f) => [f.name, f.required])).toEqual([
        ['name', true],
        ['email', true],
        ['message', true],
        ['copy', false],
      ]);
    });

    it('keeps the call to action on the brand colour, with light text', () => {
      const { document } = documentOf(byId('buildr/cta'));
      const band = Object.values(document.nodes).find((n) => n.type === 'buildr/section');
      expect(band?.styles).toMatchObject({
        base: {
          background: { color: '$color.primary' },
          typography: { color: '$color.on-primary' },
        },
      });
    });
  });
});
