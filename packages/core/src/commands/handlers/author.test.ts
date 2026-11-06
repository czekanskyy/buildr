import { describe, expect, it } from 'vitest';
import { createSeededIdGenerator } from '../../ids/seeded-id-generator.ts';
import { createRegistryMeta } from '../../registry/registry.ts';
import { p } from '../../schema/p.ts';
import { compileStyles } from '../../styles/compile.ts';
import { defaultTheme } from '../../styles/theme.ts';
import { s } from '../../values/helpers.ts';
import { execute } from '../execute.ts';
import { createCommandRegistry } from '../registry.ts';
import type { CommandEnv } from '../types.ts';
import { buildDoc, cmd, fragment, ID, node } from './handlers.test-kit.ts';
import { coreCommandHandlers } from './index.ts';

const [A, B] = [ID(1), ID(2)];

const registry = createRegistryMeta({
  components: [
    {
      type: 'buildr/page',
      version: 1,
      label: 'page',
      category: 'content',
      props: {},
      contentCategories: ['flow'],
      styles: { groups: [] },
      runtime: 'shared',
      capabilities: { root: true },
      slots: { default: {} },
    },
    {
      type: 'buildr/rich',
      version: 1,
      label: 'rich',
      category: 'content',
      props: { html: p.textarea({ format: 'html' }), plain: p.textarea() },
      contentCategories: ['flow'],
      styles: { groups: [] },
      runtime: 'shared',
    },
    {
      type: 'buildr/box',
      version: 1,
      label: 'box',
      category: 'content',
      props: { html: p.textarea({ format: 'html' }), plain: p.textarea() },
      contentCategories: ['flow'],
      styles: { groups: [] },
      runtime: 'shared',
      slots: { default: {} },
    },
  ],
});

const makeEnv = (capabilities?: CommandEnv['capabilities']): CommandEnv => ({
  registry,
  commands: createCommandRegistry(coreCommandHandlers),
  generateId: createSeededIdGenerator(3),
  ...(capabilities !== undefined ? { capabilities } : {}),
});

const doc = () => buildDoc([node(A, 'buildr/rich')], [A]);
const on = makeEnv({ authorCode: true });
const setAttr = (key: string, value: unknown) => cmd('node.setAttr', { id: A, key, value });

function failure(result: ReturnType<typeof execute>) {
  if (result.ok) throw new Error('expected a rejection');
  return result.error;
}

describe('node.setAttr author code', () => {
  const values: [string, unknown][] = [
    ['customCss', '& { color: red }'],
    ['classes', ['hero']],
    ['attributes', { 'data-x': '1' }],
  ];

  it.each(values)('refuses %s without the capability, whatever the value', (key, value) => {
    for (const env of [makeEnv(), makeEnv({}), makeEnv({ authorCode: false })]) {
      expect(failure(execute(doc(), setAttr(key, value), env)).code).toBe(
        'command.author-code-not-permitted',
      );
    }
  });

  it.each(values)('sets and removes %s with the capability', (key, value) => {
    const set = execute(doc(), setAttr(key, value), on);
    if (!set.ok) throw new Error(set.error.message);
    expect((set.value.doc.nodes[A] as unknown as Record<string, unknown>)[key]).toEqual(value);
    const removed = execute(set.value.doc, setAttr(key, null), on);
    if (!removed.ok) throw new Error(removed.error.message);
    expect(Object.hasOwn(removed.value.doc.nodes[A] ?? {}, key)).toBe(false);
  });

  it('lets anyone remove author code, even without the capability', () => {
    const withCss = {
      ...doc(),
      nodes: {
        ...doc().nodes,
        [A]: node(A, 'buildr/rich', undefined, { customCss: 'a { color: red }' }),
      },
    };
    const result = execute(withCss, setAttr('customCss', null), makeEnv());
    expect(result.ok).toBe(true);
  });

  it('checks the value even with the capability', () => {
    expect(failure(execute(doc(), setAttr('customCss', '@import "x";'), on)).code).toBe(
      'command.invalid-value',
    );
    expect(failure(execute(doc(), setAttr('customCss', 'a { background: url(x) }'), on)).code).toBe(
      'command.invalid-value',
    );
    expect(failure(execute(doc(), setAttr('classes', ['b-x']), on)).code).toBe(
      'command.invalid-value',
    );
    expect(failure(execute(doc(), setAttr('attributes', { onclick: 'x' }), on)).code).toBe(
      'command.invalid-value',
    );
    expect(failure(execute(doc(), setAttr('customCss', 5), on)).code).toBe('command.invalid-value');
  });

  it('stores the trimmed css, and canonical classes and attributes', () => {
    const css = execute(doc(), setAttr('customCss', '  a { color: red }  '), on);
    if (!css.ok) throw new Error(css.error.message);
    expect(css.value.doc.nodes[A]?.customCss).toBe('a { color: red }');
    const classes = execute(doc(), setAttr('classes', ['a', 'a', 'b']), on);
    if (!classes.ok) throw new Error(classes.error.message);
    expect(classes.value.doc.nodes[A]?.classes).toEqual(['a', 'b']);
    const attributes = execute(doc(), setAttr('attributes', { 'data-y': '2', 'data-a': '1' }), on);
    if (!attributes.ok) throw new Error(attributes.error.message);
    expect(Object.keys(attributes.value.doc.nodes[A]?.attributes ?? {})).toEqual([
      'data-a',
      'data-y',
    ]);
  });

  it('is refused on the root and respects the style lock', () => {
    expect(
      failure(
        execute(
          doc(),
          cmd('node.setAttr', { id: 'root', key: 'customCss', value: 'a { color: red }' }),
          on,
        ),
      ).code,
    ).toBe('command.invalid-attr');
    const locked = buildDoc([node(A, 'buildr/rich', undefined, { lock: { style: true } })], [A]);
    expect(execute(locked, setAttr('classes', ['x']), on).ok).toBe(false);
  });
});

describe('node.setProp on an HTML prop', () => {
  const setProp = (prop: string, value: string) =>
    cmd('node.setProp', { id: A, prop, value: s(value) });

  it('is refused without the capability and allowed for a plain textarea', () => {
    expect(failure(execute(doc(), setProp('html', '<p>x</p>'), makeEnv())).code).toBe(
      'command.author-code-not-permitted',
    );
    expect(
      failure(execute(doc(), setProp('html', '<p>x</p>'), makeEnv({ authorCode: false }))).code,
    ).toBe('command.author-code-not-permitted');
    expect(execute(doc(), setProp('plain', '<script>x</script>'), makeEnv()).ok).toBe(true);
  });

  it('stores the sanitised form', () => {
    const result = execute(doc(), setProp('html', '<p onclick="x">a<script>b</script></p>'), on);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.doc.nodes[A]?.props?.['html']).toEqual(s('<p>a</p>'));
  });

  it('refuses a binding too: HTML is a capability, not a value kind', () => {
    const bound = cmd('node.setProp', {
      id: A,
      prop: 'html',
      value: { kind: 'binding', path: 'post.body' },
    });
    expect(failure(execute(doc(), bound, makeEnv())).code).toBe(
      'command.author-code-not-permitted',
    );
  });
});

describe('node.insert with author code', () => {
  const insert = (extra: object, props?: Record<string, unknown>) =>
    cmd('node.insert', {
      parentId: 'root',
      slot: 'default',
      index: 0,
      fragment: fragment(
        [{ id: B, type: 'buildr/rich', ...(props ? { props } : {}), ...extra } as never],
        [B],
      ),
    });

  it('refuses node fields and HTML props without the capability', () => {
    expect(failure(execute(doc(), insert({ customCss: 'a { color: red }' }), makeEnv())).code).toBe(
      'command.author-code-not-permitted',
    );
    expect(failure(execute(doc(), insert({ classes: ['x'] }), makeEnv())).code).toBe(
      'command.author-code-not-permitted',
    );
    expect(failure(execute(doc(), insert({}, { html: s('<p>x</p>') }), makeEnv())).code).toBe(
      'command.author-code-not-permitted',
    );
    expect(execute(doc(), insert({}, { plain: s('x') }), makeEnv()).ok).toBe(true);
  });

  it('checks and sanitises with the capability', () => {
    expect(failure(execute(doc(), insert({ customCss: '@import "x";' }), on)).code).toBe(
      'command.invalid-value',
    );
    const result = execute(
      doc(),
      insert({ classes: ['x'] }, { html: s('<p>a<script>b</script></p>') }),
      on,
    );
    if (!result.ok) throw new Error(result.error.message);
    const inserted = Object.values(result.value.doc.nodes).find(
      (n) => n.type === 'buildr/rich' && n.id !== A,
    );
    expect(inserted?.props?.['html']).toEqual(s('<p>a</p>'));
    expect(inserted?.classes).toEqual(['x']);
  });
});

describe('node.wrap with an HTML prop on the wrapper', () => {
  const wrap = (props: Record<string, unknown>) =>
    cmd('node.wrap', { ids: [A], wrapper: { type: 'buildr/box', props } });

  it('is refused without the capability, whatever the value kind', () => {
    for (const env of [makeEnv(), makeEnv({}), makeEnv({ authorCode: false })]) {
      expect(failure(execute(doc(), wrap({ html: s('<p>x</p>') }), env)).code).toBe(
        'command.author-code-not-permitted',
      );
      expect(
        failure(execute(doc(), wrap({ html: { kind: 'binding', path: 'post.body' } }), env)).code,
      ).toBe('command.author-code-not-permitted');
    }
    // A plain textarea and a wrapper without props are not author code.
    expect(execute(doc(), wrap({ plain: s('<script>x</script>') }), makeEnv()).ok).toBe(true);
    expect(execute(doc(), wrap({}), makeEnv()).ok).toBe(true);
  });

  it('stores the sanitised form (the static value and each translation) with the capability', () => {
    const value = {
      ...s('<p onclick="x">a<script>b</script></p>'),
      l10n: { pl: '<i onload="y">c</i>' },
    };
    const result = execute(doc(), wrap({ html: value }), on);
    if (!result.ok) throw new Error(result.error.message);
    const wrapper = Object.values(result.value.doc.nodes).find((n) => n.type === 'buildr/box');
    expect(wrapper?.props?.['html']).toEqual({ ...s('<p>a</p>'), l10n: { pl: '<i>c</i>' } });
  });
});

describe('node.duplicate with author code', () => {
  const duplicate = () => cmd('node.duplicate', { ids: [A] });
  const withCss = () =>
    buildDoc([node(A, 'buildr/rich', undefined, { customCss: 'a { color: red }' })], [A]);
  const withHtml = () =>
    buildDoc([node(A, 'buildr/rich', undefined, { props: { html: s('<p>x</p>') } })], [A]);

  it('refuses to copy author code without the capability', () => {
    for (const original of [withCss(), withHtml()]) {
      for (const env of [makeEnv(), makeEnv({ authorCode: false })]) {
        expect(failure(execute(original, duplicate(), env)).code).toBe(
          'command.author-code-not-permitted',
        );
      }
      expect(execute(original, duplicate(), on).ok).toBe(true);
    }
    expect(execute(doc(), duplicate(), makeEnv()).ok).toBe(true);
  });
});

describe('compileStyles with custom CSS', () => {
  const withCss = buildDoc(
    [
      node(A, 'buildr/rich', undefined, {
        customCss: '& { color: red } a { text-decoration: none }',
      }),
    ],
    [A],
  );

  it('ignores node css without the capability, and says so', () => {
    for (const options of [
      undefined,
      {},
      { capabilities: {} },
      { capabilities: { authorCode: false } },
    ]) {
      const { css, diagnostics } = compileStyles(withCss, defaultTheme, options);
      expect(css).not.toContain('buildr.custom');
      expect(css).not.toContain('color: red');
      expect(diagnostics.map((d) => d.code)).toEqual(['author.not-permitted']);
    }
  });

  it('emits it scoped into @layer buildr.custom with the capability', () => {
    const { css, diagnostics } = compileStyles(withCss, defaultTheme, {
      capabilities: { authorCode: true },
    });
    expect(css).toContain(
      `@layer buildr.custom {\n  .b-${A} { color: red; }\n  .b-${A} a { text-decoration: none; }\n}`,
    );
    expect(css.indexOf('@layer buildr.custom')).toBeGreaterThan(css.indexOf('@layer buildr.reset'));
    expect(diagnostics.map((d) => d.code)).toEqual(['author.css-applied']);
  });

  it('keeps the two results apart in the cache, and leaves css-free documents byte-identical', () => {
    const on1 = compileStyles(withCss, defaultTheme, { capabilities: { authorCode: true } });
    const off = compileStyles(withCss, defaultTheme);
    expect(on1.css).not.toBe(off.css);
    const plain = buildDoc([node(A, 'buildr/rich')], [A]);
    expect(compileStyles(plain, defaultTheme, { capabilities: { authorCode: true } }).css).toBe(
      compileStyles(plain, defaultTheme).css,
    );
  });

  it('drops rejected rules from a document that bypassed the commands', () => {
    const bad = buildDoc(
      [
        node(A, 'buildr/rich', undefined, {
          customCss: '@import "https://evil.example/x.css"; a { color: red }',
        }),
      ],
      [A],
    );
    const { css, diagnostics } = compileStyles(bad, defaultTheme, {
      capabilities: { authorCode: true },
    });
    expect(css).not.toContain('evil.example');
    expect(css).not.toContain('@import');
    expect(diagnostics.some((d) => d.code === 'author.css-rejected')).toBe(true);
  });
});
