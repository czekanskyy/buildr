import { defaultTheme, runA11y, s, validateDocument } from '@buildr/core';
import { describe, expect, it } from 'vitest';
import { Accordion } from '../accordion/definition.ts';
import { Page } from '../page/definition.ts';
import { createRegistry, pageWith, render } from '../test-kit.tsx';
import { Text } from '../text/definition.ts';
import { AccordionItem } from './definition.ts';
import { accordionItemFixtures } from './fixtures.ts';

const registry = createRegistry({ components: [Page, Accordion, AccordionItem, Text] });

describe('buildr/accordion-item', () => {
  it('needs a summary: the accordion-structure rule', () => {
    const item = (summary: string) =>
      pageWith({
        type: 'buildr/accordion',
        children: [{ type: 'buildr/accordion-item', props: { summary: s(summary) } as never }],
      });
    expect(runA11y(item(''), registry.meta).map((i) => i.ruleId)).toContain('accordion-structure');
    expect(runA11y(item('Why?'), registry.meta).map((i) => i.ruleId)).not.toContain(
      'accordion-structure',
    );
  });

  it('binds its summary', async () => {
    const f = accordionItemFixtures[0];
    const { html } = await render(registry, pageWith(f?.tree as never), undefined, {
      faq: { question: 'Bound question?' },
    });
    expect(html).toContain('>Bound question?</summary>');
  });

  it('escapes its summary', async () => {
    const doc = pageWith({
      type: 'buildr/accordion',
      children: [
        {
          type: 'buildr/accordion-item',
          props: { summary: s('<script>alert(1)</script>') } as never,
        },
      ],
    });
    const { html } = await render(registry, doc);
    expect(html).not.toContain('<script>');
  });

  it('is inline-editable through its summary, revealed on select, and not insertable on its own', () => {
    expect(AccordionItem.meta.editor).toMatchObject({
      inlineProp: 'summary',
      revealOnSelect: true,
    });
    expect(AccordionItem.meta.capabilities?.insertable).toBe(false);
  });

  it('is only valid inside an accordion or a loop', () => {
    const outside = pageWith({ type: 'buildr/accordion-item' });
    const { issues } = validateDocument(outside, { registry: registry.meta, theme: defaultTheme });
    expect(issues.length).toBeGreaterThan(0);
  });

  it('has serializable metadata', () => {
    expect(JSON.parse(JSON.stringify(AccordionItem.meta))).toEqual(AccordionItem.meta);
  });
});
