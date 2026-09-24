import { p, s } from '@buildr/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { defineComponent } from '../define/define-component.ts';
import { createRegistry } from '../define/registry.ts';
import { dataContext, doc, ID, Loop, node, options, Page, Text } from './render.test-kit.tsx';
import { renderTree } from './render-tree.ts';

const base = {
  version: 1,
  category: 'content',
  contentCategories: ['flow'],
  styles: { groups: [] },
} as const;

const Group = defineComponent({
  ...base,
  type: 'test/group',
  label: 'Group',
  runtime: 'shared',
  props: { exclusive: p.boolean({ default: false }) },
  slots: { default: {} },
  render: ({ root, children }) => <div {...root}>{children}</div>,
});

/** Prints what its container looks like from inside. */
const Member = defineComponent({
  ...base,
  type: 'test/member',
  label: 'Member',
  runtime: 'shared',
  props: {},
  render: ({ root, node: self }) => (
    <span {...root}>{self.parent === undefined ? 'no-parent' : JSON.stringify(self.parent)}</span>
  ),
});

const registry = createRegistry({ components: [Page, Group, Member, Loop, Text] });
const html = (element: unknown) => renderToStaticMarkup(<>{element as never}</>);

describe('node.parent', () => {
  it('gives a component its container’s id, type and resolved props', () => {
    const d = doc(
      [
        node(1, 'test/group', { exclusive: s(true) }, { slots: { default: [ID(2)] } }),
        node(2, 'test/member'),
      ],
      {},
      [ID(1)],
    );
    const out = html(renderTree(d, options({ registry })));
    expect(out).toContain('{&quot;id&quot;:&quot;node000001&quot;');
    expect(out).toContain('&quot;type&quot;:&quot;test/group&quot;');
    expect(out).toContain('&quot;props&quot;:{&quot;exclusive&quot;:true}');
  });

  it('is absent for the root, and the page is the parent of its children', () => {
    const d = doc([node(1, 'test/member')], {}, [ID(1)]);
    const out = html(renderTree(d, options({ registry })));
    expect(out).toContain('&quot;type&quot;:&quot;buildr/page&quot;');
  });

  it('names the nearest container, not an ancestor', () => {
    const d = doc(
      [
        node(1, 'test/group', {}, { slots: { default: [ID(2)] } }),
        node(2, 'test/group', { exclusive: s(true) }, { slots: { default: [ID(3)] } }),
        node(3, 'test/member'),
      ],
      {},
      [ID(1)],
    );
    const out = html(renderTree(d, options({ registry })));
    expect(out).toContain('&quot;id&quot;:&quot;node000002&quot;');
    expect(out).not.toContain(
      '&quot;id&quot;:&quot;node000001&quot;,&quot;type&quot;:&quot;test/group&quot;,&quot;props&quot;:{&quot;exclusive&quot;:true}',
    );
  });

  it('makes a Loop the parent of the nodes it produces', () => {
    const d = doc(
      [
        node(
          1,
          'buildr/loop',
          { source: s({ type: 'binding', path: 'post.related' }) },
          { slots: { item: [ID(2)] } },
        ),
        node(2, 'test/member'),
      ],
      {},
      [ID(1)],
    );
    const context = dataContext({ post: { related: [{ title: 'a' }, { title: 'b' }] } });
    const out = html(renderTree(d, options({ registry, context })));
    expect(out).not.toContain('no-parent');
    expect(out.match(/&quot;type&quot;:&quot;buildr\/loop&quot;/g)).toHaveLength(2);
  });

  it('leaves the container’s slots and props untouched: siblings see the same parent', () => {
    const d = doc(
      [
        node(1, 'test/group', {}, { slots: { default: [ID(2), ID(3)] } }),
        node(2, 'test/member'),
        node(3, 'test/member'),
      ],
      {},
      [ID(1)],
    );
    const out = html(renderTree(d, options({ registry })));
    expect(out.match(/&quot;id&quot;:&quot;node000001&quot;/g)).toHaveLength(2);
  });
});
