import type { TreeNode, Value } from '@buildr/core';
import { s } from '@buildr/core';
import { describe, expect, it } from 'vitest';
import { loadDefaultRegistry } from './default-manifest.test-kit.ts';
import { documentFromTree } from './document.test-kit.ts';
import { buildOutline, outlineToJson, renderOutline } from './outline.ts';

const registry = loadDefaultRegistry();

const heading = (text: Value | string): TreeNode => ({
  type: 'buildr/heading',
  props: { text: typeof text === 'string' ? s(text) : text },
});

const page: TreeNode = {
  type: 'buildr/page',
  slots: {
    default: [
      {
        type: 'buildr/section',
        name: 'Hero',
        children: [
          heading(s('Welcome', { l10n: { pl: 'Witamy' } })),
          { type: 'buildr/text', props: { text: { kind: 'binding', path: 'post.summary' } } },
          {
            type: 'buildr/card',
            lock: { structure: true },
            slots: { default: [heading('Inside card')] },
          },
        ],
      },
      { type: 'buildr/divider', styles: { base: { visibility: { hidden: true } } } },
    ],
  },
};
const doc = documentFromTree(page);

function text(options: Parameters<typeof renderOutline>[2] = {}): string {
  const result = renderOutline(doc, registry, options);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe('renderOutline', () => {
  it('shows ids, types, names, the primary prop and markers', () => {
    expect(text()).toMatchSnapshot();
  });

  it('shows a translation when a locale is given', () => {
    expect(text({ locale: 'pl' })).toContain('"Witamy"');
    expect(text()).toContain('"Welcome"');
  });

  it('limits depth and reports what it left out', () => {
    const shallow = text({ depth: 1 });
    expect(shallow).toMatchSnapshot();
    expect(shallow).toContain('(+');
    expect(shallow).not.toContain('Welcome');
  });

  it('zooms into a subtree by node id', () => {
    const section = Object.values(doc.nodes).find((n) => n.type === 'buildr/section');
    const zoomed = text({ nodeId: section?.id });
    expect(zoomed.split('\n')[0]).toMatch(/^n\d+ buildr\/section "Hero"/);
    expect(zoomed).not.toContain('buildr/divider');
  });

  it('rejects an unknown node with an actionable message', () => {
    const result = renderOutline(doc, registry, { nodeId: 'nope' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('outline');
  });

  it('cuts at maxChars with a note on how to narrow it', () => {
    const cut = text({ maxChars: 200 });
    expect(cut.length).toBeLessThan(400);
    expect(cut).toMatch(/output cut after \d+ of \d+ nodes/);
  });
});

describe('outlineToJson', () => {
  it('has the same content as the text, as data', () => {
    const result = outlineToJson(doc, registry);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value).toMatchSnapshot();
    expect(result.value.nodeCount).toBe(Object.keys(doc.nodes).length);
  });

  it('stops at maxNodes and says so', () => {
    const result = buildOutline(doc, registry, { maxNodes: 3 });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.truncated).toBe(true);
    expect(result.value.nodeCount).toBeLessThanOrEqual(3);
  });
});

describe('a 1000-node document', () => {
  // 1 page, 50 sections, each with 1 stack holding 18 headings: 1 + 50 + 50 + 900 = 1001 nodes.
  const big = documentFromTree({
    type: 'buildr/page',
    children: Array.from({ length: 50 }, (_, s1) => ({
      type: 'buildr/section',
      name: `Section ${s1}`,
      children: [
        {
          type: 'buildr/stack',
          children: Array.from({ length: 18 }, (_, i) => heading(`Heading ${s1}.${i}`)),
        },
      ],
    })),
  });

  it('has about a thousand nodes', () => {
    expect(Object.keys(big.nodes).length).toBe(1001);
  });

  it('stays under 40k characters at depth 3', () => {
    const result = renderOutline(big, registry, { depth: 3 });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.length).toBeLessThan(40_000);
  });

  it('is complete at depth 2 (sections and stacks) and small', () => {
    const result = renderOutline(big, registry, { depth: 2 });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.length).toBeLessThan(10_000);
    expect(result.value).toContain('(+18 more)');
  });
});
