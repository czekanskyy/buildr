import {
  type BuilderDocument,
  canInsert,
  createIndex,
  fromTree,
  type PageNode,
} from '@buildr/core';
import { describe, expect, it } from 'vitest';
import { describeComponent, formatComponentDescription } from './component.ts';
import { loadDefaultRegistry } from './default-manifest.test-kit.ts';
import { parseTreeInput } from './tree-input.ts';

const registry = loadDefaultRegistry();
const types = registry.list().map((meta) => meta.type);

function described(type: string) {
  const result = describeComponent(registry, type);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe('describeComponent over every built-in component', () => {
  it('covers the whole catalogue', () => {
    expect(types).toHaveLength(26);
  });

  it.each(types)('%s: text description', (type) => {
    expect(formatComponentDescription(described(type))).toMatchSnapshot();
  });

  it.each(types)('%s: JSON description', (type) => {
    expect(described(type)).toMatchSnapshot();
  });

  it.each(types.filter((type) => type !== 'buildr/page'))(
    '%s: the example is a valid tree that canInsert accepts at its placement',
    (type) => {
      const description = described(type);
      const parsed = parseTreeInput(registry, description.example);
      if (!parsed.ok) throw new Error(parsed.error.message);
      const placement = description.placement;
      expect(placement, `${type} has a placement`).not.toBeNull();
      if (!placement) return;

      // Rebuild the wrapper chain below the root as a document, then ask the rules.
      const nodes: Record<string, PageNode> = {};
      placement.forEach((step, i) => {
        const id = i === 0 ? 'root' : `p${i}`;
        nodes[id] = {
          id,
          type: step.type,
          ...(i < placement.length - 1 ? { slots: { [step.slot]: [`p${i + 1}`] } } : {}),
        };
      });
      const doc: BuilderDocument = {
        schemaVersion: 1,
        root: 'root',
        nodes,
        components: Object.fromEntries(placement.map((step) => [step.type, 1])),
      };
      const last = placement[placement.length - 1];
      if (!last) throw new Error('empty placement');
      const fragment = fromTree(parsed.value);
      const verdict = canInsert(
        doc,
        createIndex(doc),
        registry,
        { parentId: placement.length === 1 ? 'root' : `p${placement.length - 1}`, slot: last.slot },
        fragment,
      );
      expect(verdict.ok, verdict.ok ? '' : verdict.error.message).toBe(true);
    },
  );

  it('describes the document root without a placement', () => {
    const page = described('buildr/page');
    expect(page.placement).toBeNull();
    expect(page.capabilities.rootOnly).toBe(true);
  });

  it('rejects an unknown type with the closest known ones', () => {
    const result = describeComponent(registry, 'buildr/headng');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.suggestions).toContain('buildr/heading');
      expect(result.error.message).toContain('buildr/heading');
    }
  });

  it('marks bindable and localizable props', () => {
    const heading = described('buildr/heading');
    const text = heading.props.find((prop) => prop.name === 'text');
    expect(text).toMatchObject({ kind: 'text', bindable: true, localizable: true });
  });
});
