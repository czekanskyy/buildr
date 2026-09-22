import { describe, expect, it } from 'vitest';
import { createSeededIdGenerator } from '../ids/index.ts';
import { createEmptyDocument } from './create.ts';
import type { BuilderFragment } from './fragment.ts';
import { extractFragment, fragmentSchema, reId } from './fragment.ts';
import { checkInvariants } from './invariants.ts';
import { toTree } from './tree.ts';
import type { BuilderDocument } from './types.ts';
import { ROOT_COMPONENT_TYPE } from './types.ts';

const idGen = createSeededIdGenerator('pb-010/fragment');

function sourceDocument() {
  const sectionId = idGen();
  const headingId = idGen();
  const textId = idGen();
  const asideId = idGen();
  const doc: BuilderDocument = {
    schemaVersion: 1,
    root: 'root',
    nodes: {
      root: { id: 'root', type: ROOT_COMPONENT_TYPE, slots: { default: [sectionId, asideId] } },
      [sectionId]: {
        id: sectionId,
        type: 'buildr/section',
        anchor: 'hero',
        slots: { default: [headingId, textId] },
      },
      [headingId]: { id: headingId, type: 'buildr/heading' },
      [textId]: { id: textId, type: 'buildr/text' },
      [asideId]: { id: asideId, type: 'buildr/text' },
    },
    components: {
      [ROOT_COMPONENT_TYPE]: 1,
      'buildr/section': 2,
      'buildr/heading': 1,
      'buildr/text': 3,
    },
  };
  return { doc, sectionId, headingId, textId, asideId };
}

/** A document whose `.nodes` map is `nodes` — enough for `toTree`, which never reads `.root`. */
function asDocument(nodes: BuilderDocument['nodes']): BuilderDocument {
  return { schemaVersion: 1, root: 'root', nodes, components: {} };
}

describe('extractFragment', () => {
  it('extracts a single subtree, preserving component versions from the source document', () => {
    const { doc, sectionId, headingId, textId } = sourceDocument();
    const fragment = extractFragment(doc, [sectionId]);

    expect(fragment.format).toBe('buildr/fragment');
    expect(fragment.schemaVersion).toBe(1);
    expect(fragment.roots).toEqual([sectionId]);
    expect(Object.keys(fragment.nodes).sort()).toEqual([headingId, sectionId, textId].sort());
    expect(fragment.components).toEqual({
      'buildr/section': 2,
      'buildr/heading': 1,
      'buildr/text': 3,
    });
  });

  it('produces a fragment with multiple roots for sibling ids', () => {
    const { doc, sectionId, asideId } = sourceDocument();
    const fragment = extractFragment(doc, [sectionId, asideId]);
    expect(fragment.roots).toEqual([sectionId, asideId]);
    expect(Object.keys(fragment.nodes)).toContain(asideId);
  });

  it('skips an id that is not in the document', () => {
    const { doc, sectionId } = sourceDocument();
    const fragment = extractFragment(doc, [sectionId, 'does-not-exist']);
    expect(fragment.roots).toEqual([sectionId]);
  });

  it('never extracts the document root itself', () => {
    const { doc } = sourceDocument();
    const fragment = extractFragment(doc, ['root']);
    expect(fragment.roots).toEqual([]);
    expect(fragment.nodes).toEqual({});
  });

  it('deduplicates a repeated id', () => {
    const { doc, sectionId } = sourceDocument();
    const fragment = extractFragment(doc, [sectionId, sectionId]);
    expect(fragment.roots).toEqual([sectionId]);
  });
});

describe('reId', () => {
  it('replaces every node id while preserving structure', () => {
    const { doc, sectionId } = sourceDocument();
    const fragment = extractFragment(doc, [sectionId]);
    const renamed = reId(fragment, createSeededIdGenerator('pb-010/reid'));

    expect(Object.keys(renamed.nodes)).toHaveLength(Object.keys(fragment.nodes).length);
    for (const oldId of Object.keys(fragment.nodes)) {
      expect(renamed.nodes[oldId]).toBeUndefined();
    }
    expect(renamed.components).toEqual(fragment.components);

    const originalRoot = fragment.roots[0];
    const renamedRoot = renamed.roots[0];
    if (!originalRoot || !renamedRoot) throw new Error('fixture produced no root');
    expect(toTree(asDocument(renamed.nodes), renamedRoot)).toEqual(
      toTree(asDocument(fragment.nodes), originalRoot),
    );
  });

  it('preserves a multi-root fragment', () => {
    const { doc, sectionId, asideId } = sourceDocument();
    const fragment = extractFragment(doc, [sectionId, asideId]);
    const renamed = reId(fragment, createSeededIdGenerator('pb-010/reid-multi'));

    expect(renamed.roots).toHaveLength(2);
    expect(renamed.roots[0]).not.toBe(renamed.roots[1]);
    expect(Object.keys(renamed.nodes)).toHaveLength(Object.keys(fragment.nodes).length);
  });

  it('produces ids that can be inserted twice into the same document without collision', () => {
    const { doc, sectionId } = sourceDocument();
    const fragment = extractFragment(doc, [sectionId]);
    const first = reId(fragment, createSeededIdGenerator('pb-010/copy-1'));
    const second = reId(fragment, createSeededIdGenerator('pb-010/copy-2'));
    const overlap = Object.keys(first.nodes).filter((id) => id in second.nodes);
    expect(overlap).toEqual([]);
  });

  it('defaults idGen to a real generator', () => {
    const { doc, sectionId } = sourceDocument();
    const fragment = extractFragment(doc, [sectionId]);
    const renamed = reId(fragment);
    expect(Object.keys(renamed.nodes)).toHaveLength(Object.keys(fragment.nodes).length);
  });
});

describe('fragmentSchema', () => {
  function validFragment(): BuilderFragment {
    const { doc, sectionId } = sourceDocument();
    return extractFragment(doc, [sectionId]);
  }

  it('accepts a well-formed fragment', () => {
    expect(fragmentSchema.safeParse(validFragment()).success).toBe(true);
  });

  it('rejects a root that has no matching node', () => {
    const fragment = validFragment();
    const bogusRootId = idGen();
    const result = fragmentSchema.safeParse({ ...fragment, roots: [bogusRootId] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.params).toMatchObject({ code: 'fragment.missing-root-node' });
    }
  });

  it('rejects a malformed node id used as a nodes key', () => {
    const fragment = validFragment();
    const bad = {
      ...fragment,
      nodes: { ...fragment.nodes, 'not-an-id!!': { id: 'not-an-id!!', type: 'buildr/text' } },
    };
    expect(fragmentSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects the wrong format literal', () => {
    const fragment = validFragment();
    expect(fragmentSchema.safeParse({ ...fragment, format: 'something-else' }).success).toBe(false);
  });

  it('rejects empty roots', () => {
    const fragment = validFragment();
    expect(fragmentSchema.safeParse({ ...fragment, roots: [] }).success).toBe(false);
  });
});

describe('acceptance criteria', () => {
  it('a fragment inserted into a document passes checkInvariants', () => {
    const { doc, sectionId } = sourceDocument();
    const fragment = reId(
      extractFragment(doc, [sectionId]),
      createSeededIdGenerator('pb-010/insert'),
    );

    const target = createEmptyDocument();
    const rootNode = target.nodes.root;
    if (!rootNode) throw new Error('createEmptyDocument produced no root');

    const merged: BuilderDocument = {
      ...target,
      nodes: {
        ...target.nodes,
        ...fragment.nodes,
        root: { ...rootNode, slots: { default: [...fragment.roots] } },
      },
      components: { ...target.components, ...fragment.components },
    };

    expect(checkInvariants(merged)).toEqual([]);
  });
});
