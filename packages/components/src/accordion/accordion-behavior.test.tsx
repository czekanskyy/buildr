// @vitest-environment jsdom
import { s } from '@buildr/core';
import { describe, expect, it } from 'vitest';
import { AccordionItem } from '../accordion-item/definition.ts';
import { Page } from '../page/definition.ts';
import { createRegistry, pageWith, render } from '../test-kit.tsx';
import { Text } from '../text/definition.ts';
import { Accordion } from './definition.ts';

const registry = createRegistry({ components: [Page, Accordion, AccordionItem, Text] });

async function mount(allowMultiple: boolean) {
  const doc = pageWith({
    type: 'buildr/accordion',
    props: { allowMultiple: s(allowMultiple) } as never,
    children: ['One', 'Two'].map((summary) => ({
      type: 'buildr/accordion-item',
      props: { summary: s(summary) } as never,
      children: [{ type: 'buildr/text', props: { text: s(`${summary} content`) } }],
    })),
  });
  const { html } = await render(registry, doc);
  document.body.innerHTML = html;
  return [...document.querySelectorAll('details')];
}

describe('accordion in a browser', () => {
  it('uses real summary elements, which is what gives it its keyboard behaviour', async () => {
    const items = await mount(true);
    for (const item of items) {
      const summary = item.querySelector(':scope > summary');
      expect(summary).not.toBeNull();
      // Native `summary` is focusable and toggles on Enter and Space; no tabindex or key handlers are added.
      expect(summary?.hasAttribute('tabindex')).toBe(false);
      expect(summary?.getAttribute('role')).toBeNull();
    }
  });

  it('opens and closes an item when its summary is activated', async () => {
    const [first] = await mount(true);
    expect(first?.open).toBe(false);
    first?.querySelector('summary')?.click();
    expect(first?.open).toBe(true);
    first?.querySelector('summary')?.click();
    expect(first?.open).toBe(false);
  });

  it('lets independent items stay open together', async () => {
    const [first, second] = await mount(true);
    first?.querySelector('summary')?.click();
    second?.querySelector('summary')?.click();
    expect(first?.open).toBe(true);
    expect(second?.open).toBe(true);
  });

  it('works with no script at all: the items are plain markup', async () => {
    await mount(false);
    expect(document.querySelectorAll('script')).toHaveLength(0);
    expect(document.querySelectorAll('details[name]')).toHaveLength(2);
  });
});
