import { defaultTheme, runA11y, s, validateDocument } from '@next-buildr/core';
import { describe, expect, it } from 'vitest';
import { ListItem } from '../list-item/definition.ts';
import { Page } from '../page/definition.ts';
import { createRegistry, pageWith, problemsOf, render } from '../test-kit.tsx';
import { Text } from '../text/definition.ts';
import { List } from './definition.ts';
import { listFixtures } from './fixtures.ts';

const registry = createRegistry({ components: [Page, List, ListItem, Text] });
const items = (...texts: string[]) =>
  texts.map((text) => ({ type: 'buildr/list-item', props: { text: s(text) } }));
const list = (props: Record<string, unknown>, children: unknown[]) =>
  pageWith({ type: 'buildr/list', props: props as never, children: children as never });

describe('buildr/list', () => {
  it('renders a ul of li, with the root attributes', async () => {
    const { html, diagnostics } = await render(registry, list({}, items('One', 'Two')));
    expect(diagnostics).toEqual([]);
    expect(html).toMatch(
      /<ul class="bc-list b-[^"]+"><li class="bc-list-item b-[^"]+">One<\/li><li class="bc-list-item b-[^"]+">Two<\/li><\/ul>/,
    );
  });

  it('renders an ol when numbered', async () => {
    const { html } = await render(registry, list({ ordered: s(true) }, items('One')));
    expect(html).toMatch(/<ol class="bc-list b-[^"]+" data-ordered="">/);
    expect(html).not.toContain('<ul');
  });

  it('nests', async () => {
    const fixture = listFixtures.find((f) => f.id === 'list-numbered');
    const { html } = await render(registry, pageWith(fixture?.tree as never));
    expect(html).toMatch(/<ol [^>]*>.*<li [^>]*>Second<ul [^>]*>.*Nested a.*<\/ul><\/li><\/ol>/);
  });

  it('carries three default items', () => {
    const items = List.meta.defaults?.slots?.['default'] ?? [];
    expect(items).toHaveLength(3);
    expect(items.every((item) => item.type === 'buildr/list-item')).toBe(true);
  });

  it('accepts only list items in its slot: the list-structure rule and the placement check agree', () => {
    const doc = list({}, [{ type: 'buildr/text', props: { text: s('Not an item') } }]);
    expect(runA11y(doc, registry.meta).map((i) => i.ruleId)).toContain('list-structure');
    const issues = validateDocument(doc, { registry: registry.meta, theme: defaultTheme }).issues;
    expect(issues.length).toBeGreaterThan(0);
    const fine = list({}, items('a'));
    expect(runA11y(fine, registry.meta).map((i) => i.ruleId)).not.toContain('list-structure');
    expect(validateDocument(fine, { registry: registry.meta, theme: defaultTheme }).issues).toEqual(
      [],
    );
  });

  it('has valid, accessible fixtures', () => {
    for (const fixture of listFixtures) expect(problemsOf(registry, fixture)).toEqual([]);
  });

  it('has serializable metadata', () => {
    expect(JSON.parse(JSON.stringify(List.meta))).toEqual(List.meta);
  });
});
