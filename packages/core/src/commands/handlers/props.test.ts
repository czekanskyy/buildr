import { describe, expect, it } from 'vitest';
import { bind, expr, s } from '../../values/helpers.ts';
import type { Value } from '../../values/types.ts';
import { applyDocumentPatches } from '../apply-patches.ts';
import { canExecute, execute } from '../execute.ts';
import { buildDoc, cmd, env, ID, node, snapshot } from './handlers.test-kit.ts';
import { setPropHandler, unsetPropHandler } from './props.ts';

const H = ID(1);
const T = ID(2);

const heading = (props?: Record<string, Value>, extra = {}) =>
  node(H, 'buildr/heading', undefined, { ...(props ? { props } : {}), ...extra });
const doc = (props?: Record<string, Value>, extra = {}) => buildDoc([heading(props, extra)], [H]);

const setProp = (prop: string, value: Value, locale?: string, id = H) =>
  cmd('node.setProp', { id, prop, value, ...(locale !== undefined ? { locale } : {}) });
const unsetProp = (prop: string, locale?: string, id = H) =>
  cmd('node.unsetProp', { id, prop, ...(locale !== undefined ? { locale } : {}) });

function run(
  d: ReturnType<typeof doc>,
  command: ReturnType<typeof setProp> | ReturnType<typeof unsetProp>,
) {
  const result = execute(d, command, env);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
}

function rejected(d: ReturnType<typeof doc>, command: Parameters<typeof execute>[1]) {
  const before = snapshot(d);
  const result = execute(d, command, env);
  expect(snapshot(d)).toBe(before);
  if (result.ok) throw new Error('expected a rejection');
  return result.error;
}

describe('node.setProp', () => {
  it('sets a static value on a node without props', () => {
    const { doc: next, affected } = run(doc(), setProp('title', s('Hello')));
    expect(next.nodes[H]?.props).toEqual({ title: s('Hello') });
    expect(affected).toEqual([H]);
  });

  it('replaces a value, and can change its kind in the default language', () => {
    const start = doc({ title: s('Old') });
    expect(run(start, setProp('title', s('New'))).doc.nodes[H]?.props?.title).toEqual(s('New'));
    const bound = run(start, setProp('title', bind('post.title'))).doc.nodes[H]?.props?.title;
    expect(bound).toEqual(bind('post.title'));
    const formula = run(start, setProp('level', expr('1 + 1'))).doc.nodes[H]?.props?.level;
    expect(formula).toEqual(expr('1 + 1'));
    const template = run(start, setProp('title', expr('Hi {{ name }}', { mode: 'template' })));
    expect(template.doc.nodes[H]?.props?.title).toMatchObject({ kind: 'expression' });
  });

  it('accepts a bound value with a valid fallback, and a value carrying translations', () => {
    run(doc(), setProp('title', bind('post.title', { fallback: 'Untitled' })));
    run(doc(), setProp('title', s('Hello', { l10n: { pl: 'Cześć' } })));
  });

  it('undo restores the document exactly, and patches redo', () => {
    const before = doc({ title: s('Old') });
    for (const command of [
      setProp('title', s('New')),
      setProp('level', s(3)),
      unsetProp('title'),
    ]) {
      const result = run(before, command);
      const undone = applyDocumentPatches(result.doc, result.inverse);
      expect(undone.ok && undone.value).toEqual(before);
      const redone = applyDocumentPatches(before, result.patches);
      expect(redone.ok && redone.value).toEqual(result.doc);
    }
  });

  it('does not mutate its input', () => {
    const d = doc({ title: s('Old') });
    const before = snapshot(d);
    run(d, setProp('title', s('New')));
    run(d, setProp('title', s('Nowy'), 'pl'));
    expect(snapshot(d)).toBe(before);
  });
});

describe('node.setProp rejections', () => {
  it('an unknown prop, node or component', () => {
    expect(rejected(doc(), setProp('nope', s('x'))).code).toBe('command.unknown-prop');
    expect(rejected(doc(), setProp('__proto__', s('x'))).code).toBe('command.invalid-payload');
    expect(rejected(doc(), setProp('title', s('x'), undefined, T)).reason?.code).toBe(
      'node-not-found',
    );
  });

  it('a static value the prop kind rejects', () => {
    expect(rejected(doc(), setProp('title', s(5))).code).toBe('command.invalid-value');
    expect(rejected(doc(), setProp('title', s('x'.repeat(21)))).code).toBe('command.invalid-value');
    expect(rejected(doc(), setProp('level', s(9))).code).toBe('command.invalid-value');
    expect(rejected(doc(), setProp('level', s('3'))).code).toBe('command.invalid-value');
  });

  it('a translation the prop kind rejects, or on a prop that is not localizable', () => {
    expect(rejected(doc(), setProp('title', s('x', { l10n: { pl: 5 } as never }))).code).toBe(
      'command.invalid-value',
    );
    expect(rejected(doc(), setProp('code', s('x', { l10n: { pl: 'y' } }))).code).toBe(
      'command.not-localizable',
    );
  });

  it('a binding or expression on a prop that is not bindable, and malformed ones', () => {
    expect(rejected(doc(), setProp('plain', bind('a.b'))).code).toBe('command.not-bindable');
    expect(rejected(doc(), setProp('plain', expr('1 + 1'))).code).toBe('command.not-bindable');
    expect(rejected(doc(), setProp('title', bind('a..b'))).code).toBe('command.invalid-value');
    expect(rejected(doc(), setProp('title', bind('__proto__.x'))).code).toBe(
      'command.invalid-value',
    );
    expect(rejected(doc(), setProp('title', expr('1 +'))).code).toBe('command.invalid-value');
    expect(rejected(doc(), setProp('title', expr('{{ oops', { mode: 'template' }))).code).toBe(
      'command.invalid-value',
    );
    expect(rejected(doc(), setProp('title', bind('a.b', { fallback: 5 as never }))).code).toBe(
      'command.invalid-value',
    );
  });

  it('a content-locked node', () => {
    expect(
      rejected(doc(undefined, { lock: { content: true } }), setProp('title', s('x'))).reason?.code,
    ).toBe('locked-content');
  });

  it('a malformed payload', () => {
    for (const payload of [
      null,
      {},
      { id: H, prop: 'title' },
      { id: H, prop: 'title', value: 'x' },
      { id: H, prop: 'title', value: { kind: 'nope' } },
    ]) {
      expect(rejected(doc(), { type: 'node.setProp', payload }).code).toBe(
        'command.invalid-payload',
      );
    }
  });

  it('canExecute agrees', () => {
    expect(canExecute(doc(), setProp('title', s('x')), env).ok).toBe(true);
    expect(canExecute(doc(), setProp('nope', s('x')), env).ok).toBe(false);
  });
});

describe('node.setProp with a locale', () => {
  const translated = () => doc({ title: s('Hello') });

  it('writes and overwrites a translation next to the default value', () => {
    const first = run(translated(), setProp('title', s('Cześć'), 'pl')).doc;
    expect(first.nodes[H]?.props?.title).toEqual(s('Hello', { l10n: { pl: 'Cześć' } }));
    const second = run(first, setProp('title', s('Hej'), 'pl')).doc;
    expect(second.nodes[H]?.props?.title).toEqual(s('Hello', { l10n: { pl: 'Hej' } }));
    const third = run(second, setProp('title', s('Hallo'), 'de')).doc;
    expect(third.nodes[H]?.props?.title).toEqual(s('Hello', { l10n: { pl: 'Hej', de: 'Hallo' } }));
  });

  it('translates a template-mode expression', () => {
    const d = doc({ title: expr('Hi {{ name }}', { mode: 'template' }) });
    const next = run(d, setProp('title', expr('Cześć {{ name }}', { mode: 'template' }), 'pl')).doc;
    expect(next.nodes[H]?.props?.title).toMatchObject({ l10n: { pl: 'Cześć {{ name }}' } });
  });

  it('rejects translating a binding, a formula, a missing value or a non-localizable prop', () => {
    expect(rejected(doc({ title: bind('a.b') }), setProp('title', s('x'), 'pl')).code).toBe(
      'command.not-translatable',
    );
    expect(rejected(translated(), setProp('title', bind('a.b'), 'pl')).code).toBe(
      'command.not-translatable',
    );
    expect(rejected(doc({ title: expr('1') }), setProp('title', s('x'), 'pl')).code).toBe(
      'command.not-translatable',
    );
    expect(rejected(doc(), setProp('title', s('x'), 'pl')).code).toBe('command.no-base-value');
    expect(rejected(doc({ code: s('a') }), setProp('code', s('b'), 'pl')).code).toBe(
      'command.not-localizable',
    );
  });

  it('cannot change the value kind outside the default language', () => {
    const d = doc({ title: expr('Hi', { mode: 'template' }) });
    expect(rejected(d, setProp('title', s('x'), 'pl')).code).toBe('command.value-kind-mismatch');
    expect(
      rejected(translated(), setProp('title', expr('x', { mode: 'template' }), 'pl')).code,
    ).toBe('command.value-kind-mismatch');
  });

  it('validates the translation like the value', () => {
    expect(rejected(translated(), setProp('title', s('x'.repeat(21)), 'pl')).code).toBe(
      'command.invalid-value',
    );
    const d = doc({ title: expr('Hi', { mode: 'template' }) });
    expect(rejected(d, setProp('title', expr('{{ oops', { mode: 'template' }), 'pl')).code).toBe(
      'command.invalid-value',
    );
    expect(rejected(translated(), setProp('title', s('x', { l10n: { de: 'y' } }), 'pl')).code).toBe(
      'command.invalid-value',
    );
  });
});

describe('node.unsetProp', () => {
  it('removes a prop and drops the empty props object', () => {
    const one = run(doc({ title: s('a') }), unsetProp('title')).doc;
    expect(one.nodes[H]).not.toHaveProperty('props');
    const two = run(doc({ title: s('a'), level: s(2) }), unsetProp('title')).doc;
    expect(two.nodes[H]?.props).toEqual({ level: s(2) });
  });

  it('removes one translation and drops an empty l10n', () => {
    const d = doc({ title: s('Hello', { l10n: { pl: 'Cześć', de: 'Hallo' } }) });
    const one = run(d, unsetProp('title', 'pl')).doc;
    expect(one.nodes[H]?.props?.title).toEqual(s('Hello', { l10n: { de: 'Hallo' } }));
    const two = run(one, unsetProp('title', 'de')).doc;
    expect(two.nodes[H]?.props?.title).toEqual(s('Hello'));
    expect(two.nodes[H]?.props?.title).not.toHaveProperty('l10n');
  });

  it('removing something that is not there changes nothing', () => {
    const d = doc({ title: s('a') });
    for (const command of [unsetProp('level'), unsetProp('title', 'pl')]) {
      const result = run(d, command);
      expect(result.doc).toBe(d);
      expect(result.patches).toEqual([]);
    }
  });

  it('rejects an unknown prop, a missing node and a content lock', () => {
    expect(rejected(doc(), unsetProp('nope')).code).toBe('command.unknown-prop');
    expect(rejected(doc(), unsetProp('title', undefined, T)).reason?.code).toBe('node-not-found');
    expect(
      rejected(doc({ title: s('a') }, { lock: { content: true } }), unsetProp('title')).reason
        ?.code,
    ).toBe('locked-content');
  });

  it('undo restores translations exactly', () => {
    const before = doc({ title: s('Hello', { l10n: { pl: 'Cześć' } }) });
    const result = run(before, unsetProp('title', 'pl'));
    const undone = applyDocumentPatches(result.doc, result.inverse);
    expect(undone.ok && undone.value).toEqual(before);
  });
});

describe('coalescing keys', () => {
  it('follow prop:<id>:<prop>:<locale>', () => {
    const set = setPropHandler.mergeKey?.(setProp('title', s('x'), 'pl') as never);
    expect(set).toBe(`prop:${H}:title:pl`);
    expect(setPropHandler.mergeKey?.(setProp('title', s('x')) as never)).toBe(`prop:${H}:title:`);
    expect(unsetPropHandler.mergeKey?.(unsetProp('title', 'pl') as never)).toBe(set);
  });
});
