import { fromTree } from '@next-buildr/core';
import { describe, expect, it } from 'vitest';
import { loadDefaultRegistry } from './default-manifest.test-kit.ts';
import {
  createTreeInputSchema,
  MAX_TREE_NODES,
  parseTreeInput,
  treeInputJsonSchema,
} from './tree-input.ts';

const registry = loadDefaultRegistry();

function parse(input: unknown) {
  return parseTreeInput(registry, input);
}

function failure(input: unknown) {
  const result = parse(input);
  if (result.ok) throw new Error('expected the tree to be rejected');
  return result.error;
}

describe('parseTreeInput', () => {
  it('turns plain values into static values and keeps full Values', () => {
    const result = parse({
      type: 'buildr/section',
      children: [
        { type: 'buildr/heading', props: { text: 'Hello', level: 1 } },
        {
          type: 'buildr/heading',
          props: {
            text: { kind: 'static', value: 'Hallo', l10n: { pl: 'Czesc' } },
            level: 2,
          },
        },
      ],
    });
    if (!result.ok) throw new Error(result.error.message);
    const [plain, full] = result.value.slots?.['default'] ?? [];
    expect(plain?.props?.['text']).toEqual({ kind: 'static', value: 'Hello' });
    expect(full?.props?.['text']).toMatchObject({ l10n: { pl: 'Czesc' } });
    expect(() => fromTree(result.value)).not.toThrow();
  });

  it('rejects an unknown type with the valid ones and a did-you-mean', () => {
    const error = failure({ type: 'buildr/headng' });
    expect(error.issues[0]?.message).toContain('Did you mean "buildr/heading"');
    expect(error.issues[0]?.validOptions).toContain('buildr/heading');
  });

  it('rejects an unknown type with no close match by listing valid types', () => {
    const error = failure({ type: 'acme/zzzzzzzzzz' });
    expect(error.issues[0]?.message).toContain('Valid component types');
    expect(error.issues[0]?.validOptions).toContain('buildr/section');
  });

  it('rejects an unknown prop with the valid props', () => {
    const error = failure({ type: 'buildr/heading', props: { txt: 'x' } });
    expect(error.issues[0]).toMatchObject({ path: 'props.txt' });
    expect(error.issues[0]?.message).toContain('Did you mean "text"');
    expect(error.issues[0]?.validOptions).toEqual(['text', 'level']);
  });

  it('checks prop values against their kind', () => {
    expect(failure({ type: 'buildr/heading', props: { level: 9 } }).issues[0]?.message).toContain(
      'buildr/heading.level',
    );
    expect(
      failure({ type: 'buildr/heading', props: { text: { kind: 'binding', path: 'a..b' } } })
        .issues[0]?.message,
    ).toContain('invalid binding path');
    expect(
      failure({ type: 'buildr/heading', props: { text: { kind: 'expression', expr: '1 +' } } })
        .issues[0]?.message,
    ).toContain('invalid expression');
  });

  it('rejects an unknown slot and children on a leaf', () => {
    expect(
      failure({ type: 'buildr/card', slots: { footer: [] } }).issues[0]?.validOptions,
    ).toContain('body');
    expect(
      failure({ type: 'buildr/heading', children: [{ type: 'buildr/text' }] }).issues[0]?.message,
    ).toContain('leaf');
  });

  it('rejects a child the slot does not allow, naming what is allowed', () => {
    const error = failure({ type: 'buildr/accordion', children: [{ type: 'buildr/heading' }] });
    expect(error.issues[0]?.message).toContain(
      'cannot be placed in slot "default" of buildr/accordion',
    );
    expect(error.issues[0]?.validOptions).toContain('buildr/accordion-item');
  });

  it('allows a component that is not insertable on its own inside its parent', () => {
    expect(parse({ type: 'buildr/list', children: [{ type: 'buildr/list-item' }] }).ok).toBe(true);
    const alone = failure({ type: 'buildr/list-item' });
    expect(alone.issues[0]?.message).toContain('cannot be inserted on its own');
    expect(alone.issues[0]?.message).toContain('buildr/list');
  });

  it('rejects the root component, both children and slots, and bad styles', () => {
    expect(failure({ type: 'buildr/page' }).issues[0]?.message).toContain('document root');
    expect(
      failure({ type: 'buildr/section', children: [], slots: { default: [] } }).issues[0]?.message,
    ).toContain('either');
    expect(
      failure({ type: 'buildr/section', styles: { base: { nope: 1 } } }).issues[0]?.message,
    ).toContain('invalid styles');
  });

  it('reports every problem at once', () => {
    const error = failure({
      type: 'buildr/section',
      children: [{ type: 'buildr/nope' }, { type: 'buildr/heading', props: { txt: 1 } }],
    });
    expect(error.issues).toHaveLength(2);
    expect(error.message.split('\n')).toHaveLength(2);
  });

  it('rejects malformed input structurally', () => {
    expect(failure('nope').issues.length).toBeGreaterThan(0);
    expect(failure({ type: 'buildr/heading', extra: 1 }).issues[0]?.message).toMatch(
      /unrecognized/i,
    );
  });

  it('limits the size of a tree', () => {
    const wide = {
      type: 'buildr/section',
      children: Array.from({ length: MAX_TREE_NODES + 5 }, () => ({ type: 'buildr/divider' })),
    };
    expect(failure(wide).message).toContain('more than');
  });
});

describe('the tree JSON Schema', () => {
  const schema = treeInputJsonSchema(registry);

  it('is described, ready for a tool definition', () => {
    expect(schema).toMatchSnapshot();
    const text = JSON.stringify(schema);
    expect(text).toContain('Component type');
    expect(text).toContain('buildr/heading');
  });

  it('is an object at the root (MCP tool input schemas must be)', () => {
    expect(schema['type']).toBe('object');
  });

  it('is available without a registry', () => {
    expect(createTreeInputSchema().safeParse({ type: 'x/y' }).success).toBe(true);
    expect(treeInputJsonSchema()['type']).toBe('object');
  });
});
