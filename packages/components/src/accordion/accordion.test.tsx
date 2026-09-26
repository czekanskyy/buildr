import { defaultTheme, s, validateDocument } from '@next-buildr/core';
import { describe, expect, it } from 'vitest';
import { AccordionItem } from '../accordion-item/definition.ts';
import { accordionItemFixtures } from '../accordion-item/fixtures.ts';
import { Page } from '../page/definition.ts';
import { createRegistry, pageWith, problemsOf, render } from '../test-kit.tsx';
import { Text } from '../text/definition.ts';
import { Accordion } from './definition.ts';
import { accordionFixtures } from './fixtures.ts';

const registry = createRegistry({ components: [Page, Accordion, AccordionItem, Text] });
const fixture = (id: string) => pageWith(accordionFixtures.find((f) => f.id === id)?.tree as never);

describe('buildr/accordion', () => {
  it('renders one div of details elements, each with a native summary', async () => {
    const { html, diagnostics } = await render(registry, fixture('accordion-faq'));
    expect(diagnostics).toEqual([]);
    expect(html).toMatch(/<div class="bc-accordion b-[^"]+">/);
    expect(html.match(/<details /g)).toHaveLength(3);
    expect(html.match(/<summary class="bc-accordion-item__summary">/g)).toHaveLength(3);
    expect(html).toContain('>What is Buildr?</summary>');
    expect(html).toContain('bc-accordion-item__content"><p ');
  });

  it('opens the items marked defaultOpen, and no other', async () => {
    const { html } = await render(registry, fixture('accordion-faq'));
    expect(html.match(/<details [^>]*\bopen=""/g)).toHaveLength(1);
  });

  it('lets several be open at once by default: no shared name', async () => {
    const { html } = await render(registry, fixture('accordion-faq'));
    expect(html).not.toContain('name=');
  });

  it('makes the items exclusive with one shared name when several may not be open', async () => {
    const { html } = await render(registry, fixture('accordion-exclusive'));
    const names = [...html.matchAll(/<details [^>]*\bname="([^"]+)"/g)].map((m) => m[1]);
    expect(names).toHaveLength(3);
    expect(new Set(names).size).toBe(1);
    expect(names[0]).toMatch(/^bc-accordion-/);
  });

  it('gives two accordions different group names', async () => {
    const doc = pageWith({
      type: 'buildr/stack',
      children: [
        {
          type: 'buildr/accordion',
          props: { allowMultiple: s(false) },
          children: [{ type: 'buildr/accordion-item' }],
        },
        {
          type: 'buildr/accordion',
          props: { allowMultiple: s(false) },
          children: [{ type: 'buildr/accordion-item' }],
        },
      ],
    });
    const stackRegistry = createRegistry({
      components: [Page, Accordion, AccordionItem, (await import('../stack/definition.ts')).Stack],
    });
    const { html } = await render(stackRegistry, doc);
    const names = [...html.matchAll(/<details [^>]*\bname="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(names).size).toBe(2);
  });

  it('carries three default items', () => {
    const items = Accordion.meta.defaults?.slots?.['default'] ?? [];
    expect(items).toHaveLength(3);
    expect(items.every((item) => item.type === 'buildr/accordion-item')).toBe(true);
  });

  it('accepts only accordion items (or a loop) in its slot', () => {
    const wrong = pageWith({
      type: 'buildr/accordion',
      children: [{ type: 'buildr/text', props: { text: s('x') } }],
    });
    const { issues } = validateDocument(wrong, { registry: registry.meta, theme: defaultTheme });
    expect(issues.length).toBeGreaterThan(0);
    expect(
      validateDocument(fixture('accordion-faq'), { registry: registry.meta, theme: defaultTheme })
        .issues,
    ).toEqual([]);
  });

  it('has valid, accessible fixtures', () => {
    for (const f of [...accordionFixtures, ...accordionItemFixtures]) {
      expect(problemsOf(registry, f)).toEqual([]);
    }
  });

  it('has serializable metadata', () => {
    expect(JSON.parse(JSON.stringify(Accordion.meta))).toEqual(Accordion.meta);
  });
});
