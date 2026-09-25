import { s } from '@buildr/core';
import { describe, expect, it } from 'vitest';
import { loadDefaultRegistry } from './default-manifest.test-kit.ts';
import { documentFromTree } from './document.test-kit.ts';
import { describeNode, formatNodeDetail } from './node.ts';

const registry = loadDefaultRegistry();
const doc = documentFromTree({
  type: 'buildr/page',
  children: [
    {
      type: 'buildr/section',
      anchor: 'hero',
      styles: {
        base: { spacing: { padding: { top: '$space.8' } } },
        bp: { md: { layout: { gap: 8 } } },
      },
      children: [
        {
          type: 'buildr/heading',
          name: 'Title',
          props: {
            text: s('Welcome', { l10n: { pl: 'Witamy' } }),
            level: s(1),
          },
        },
        {
          type: 'buildr/text',
          props: { text: { kind: 'binding', path: 'post.summary', fallback: '-' } },
        },
        {
          type: 'buildr/text',
          props: { text: { kind: 'expression', expr: 'post.title', mode: 'formula' } },
        },
      ],
    },
  ],
});

function ids(type: string): string[] {
  return Object.values(doc.nodes)
    .filter((n) => n.type === type)
    .map((n) => n.id);
}

function render(id: string | undefined): string {
  const result = describeNode(doc, registry, id as string);
  if (!result.ok) throw new Error(result.error.message);
  return formatNodeDetail(result.value);
}

describe('describeNode', () => {
  it('gives every prop as a Value, styles per layer and the place in the tree', () => {
    const [id] = ids('buildr/heading');
    const result = describeNode(doc, registry, id as string);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value).toMatchSnapshot();
    expect(result.value.props['text']).toEqual({
      kind: 'static',
      value: 'Welcome',
      l10n: { pl: 'Witamy' },
    });
    expect(result.value.parent).toMatchObject({ slot: 'default', index: 0 });
  });

  it('renders text with bindings, expressions, translations and styles', () => {
    const [section] = ids('buildr/section');
    const [heading] = ids('buildr/heading');
    const [binding, expression] = ids('buildr/text');
    expect(render(section)).toMatchSnapshot();
    expect(render(heading)).toMatchSnapshot();
    expect(render(binding)).toContain('binding post.summary');
    expect(render(expression)).toContain('expression');
  });

  it('rejects an unknown node', () => {
    const result = describeNode(doc, registry, 'missing');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('outline');
  });
});
