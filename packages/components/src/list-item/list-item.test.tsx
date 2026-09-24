import { defaultTheme, s, validateDocument } from '@buildr/core';
import { describe, expect, it } from 'vitest';
import { List } from '../list/definition.ts';
import { Page } from '../page/definition.ts';
import { createRegistry, pageWith, problemsOf, render } from '../test-kit.tsx';
import { ListItem } from './definition.ts';
import { listItemFixtures } from './fixtures.ts';

const registry = createRegistry({ components: [Page, List, ListItem] });

describe('buildr/list-item', () => {
  it('renders its text and its extra content in one li', async () => {
    const doc = pageWith({
      type: 'buildr/list',
      children: [
        {
          type: 'buildr/list-item',
          props: { text: s('Parent') },
          children: [{ type: 'buildr/list', children: [{ type: 'buildr/list-item' }] }],
        },
      ],
    });
    const { html } = await render(registry, doc);
    expect(html).toMatch(/<li class="bc-list-item b-[^"]+">Parent<ul /);
  });

  it('binds its text', async () => {
    const fixture = listItemFixtures[0];
    const { html } = await render(registry, pageWith(fixture?.tree as never), undefined, {
      post: { title: 'From data' },
    });
    expect(html).toContain('>Static</li>');
    expect(html).toContain('>From data</li>');
  });

  it('is only valid inside a list or a loop', () => {
    const outside = pageWith({ type: 'buildr/list-item' });
    const issues = validateDocument(outside, {
      registry: registry.meta,
      theme: defaultTheme,
    }).issues;
    expect(issues.length).toBeGreaterThan(0);
  });

  it('is not offered in the palette on its own, and is inline-editable', () => {
    expect(ListItem.meta.capabilities?.insertable).toBe(false);
    expect(ListItem.meta.editor?.inlineProp).toBe('text');
  });

  it('has valid fixtures and serializable metadata', () => {
    for (const fixture of listItemFixtures) expect(problemsOf(registry, fixture)).toEqual([]);
    expect(JSON.parse(JSON.stringify(ListItem.meta))).toEqual(ListItem.meta);
  });
});
