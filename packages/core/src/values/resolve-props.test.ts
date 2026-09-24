import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { DataContext } from '../data/context.ts';
import type { PageNode } from '../document/types.ts';
import { createCompileCache } from '../expressions/compile.ts';
import type { JsonValue } from '../json/json-value.ts';
import type { ComponentMeta } from '../registry/meta.ts';
import { p } from '../schema/p.ts';
import { bind, expr, s, withTranslation } from './helpers.ts';
import { resolveProps, resolveVisibility } from './resolve-props.ts';

const NODE_ID = 'node_1';

function makeCtx(scopes: Record<string, JsonValue> = {}, overrides: Partial<DataContext> = {}) {
  return {
    scopes,
    locale: 'en',
    locales: { default: 'en', fallback: true, intl: { en: 'English', pl: 'Polski' } },
    timeZone: 'UTC',
    mode: 'production',
    ...overrides,
  } satisfies DataContext;
}

const DATA: Record<string, JsonValue> = {
  post: {
    title: 'Hello',
    views: 1234.5,
    featured: true,
    url: 'https://example.com/a',
    evil: 'javascript:alert(1)',
    nothing: null,
    tags: ['a', 'b'],
    cover: { id: 'm1' },
    when: '2026-03-05T12:00:00Z',
  },
};

const meta = (props: ComponentMeta['props']): ComponentMeta =>
  ({ type: 'test/thing', props }) as unknown as ComponentMeta;

const node = (props: Record<string, unknown>, extra: Partial<PageNode> = {}): PageNode =>
  ({ id: NODE_ID, type: 'test/thing', props, ...extra }) as unknown as PageNode;

const META = meta({
  title: p.text({ default: 'Untitled', maxLength: 10 }),
  body: p.textarea({ default: '' }),
  count: p.number({ default: 0 }),
  shown: p.boolean({ default: false }),
  href: p.link({ default: '/home' }),
  rich: p.richText(),
  cover: p.media(),
  source: p.listSource(),
  size: p.select({ options: ['s', 'm'], default: 'm' } as never),
  icon: p.icon({ default: 'star' } as never),
  fixed: p.text({ default: 'x', localizable: false }),
});

function resolve(props: Record<string, unknown>, ctx = makeCtx(DATA), m = META) {
  return resolveProps(node(props), m, ctx);
}

describe('resolveProps: static values', () => {
  it('uses defaults for missing props and drops undeclared ones', () => {
    const { props, diagnostics } = resolve({ unknown: s('x') });
    expect(props).toMatchObject({ title: 'Untitled', count: 0, shown: false, href: '/home' });
    expect(props).not.toHaveProperty('unknown');
    expect(diagnostics).toEqual([]);
  });

  it('passes valid static values through', () => {
    const { props, diagnostics } = resolve({
      title: s('Hi'),
      count: s(3),
      shown: s(true),
      href: s('https://example.com'),
      size: s('s'),
    });
    expect(props).toMatchObject({
      title: 'Hi',
      count: 3,
      shown: true,
      href: 'https://example.com',
      size: 's',
    });
    expect(diagnostics).toEqual([]);
  });

  it('caps over-long text with a warning', () => {
    const { props, diagnostics } = resolve({ title: s('x'.repeat(30)) });
    expect(props['title']).toBe('x'.repeat(10));
    expect(diagnostics.map((d) => d.code)).toEqual(['prop.truncated']);
  });

  it('sanitizes a static link and falls back to the default', () => {
    const { props, diagnostics } = resolve({ href: s('javascript:alert(1)') });
    expect(props['href']).toBe('/home');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.severity).toBe('error');
  });

  it('rejects a static value of the wrong type', () => {
    const { props, diagnostics } = resolve({ count: s('many') });
    expect(props['count']).toBe(0);
    expect(diagnostics[0]?.code).toBe('prop.invalid-value');
  });

  it('reports a malformed value and uses the default', () => {
    const { props, diagnostics } = resolve({
      title: 'raw string',
      count: null,
      shown: { kind: 'x' },
    });
    expect(props).toMatchObject({ title: 'Untitled', count: 0, shown: false });
    expect(diagnostics.map((d) => d.code)).toEqual([
      'prop.invalid-value',
      'prop.invalid-value',
      'prop.invalid-value',
    ]);
  });

  it('omits a prop that has neither a value nor a usable default', () => {
    const { props } = resolve(
      {},
      makeCtx(DATA),
      meta({ nothing: { ...p.text(), default: undefined } as never }),
    );
    expect(props).not.toHaveProperty('nothing');
  });
});

describe('resolveProps: bindings', () => {
  it.each([
    ['title', bind('post.title'), 'Hello'],
    ['count', bind('post.views'), 1234.5],
    ['shown', bind('post.featured'), true],
    ['href', bind('post.url'), 'https://example.com/a'],
    ['cover', bind('post.cover'), { id: 'm1' }],
    ['source', bind('post.tags'), ['a', 'b']],
    ['body', bind('post.views'), '1,234.5'],
  ])('%s', (prop, value, expected) => {
    const { props, diagnostics } = resolve({ [prop]: value });
    expect(props[prop]).toEqual(expected);
    expect(diagnostics).toEqual([]);
  });

  it('applies the format', () => {
    const { props } = resolve({
      body: bind('post.views', { format: { type: 'number', maximumFractionDigits: 0 } }),
    });
    expect(props['body']).toBe('1,235');
    const dated = resolve({ body: bind('post.when', { format: { type: 'date', style: 'iso' } }) });
    expect(dated.props['body']).toBe('2026-03-05T12:00:00.000Z');
  });

  it('wraps rich text from a plain string', () => {
    const { props } = resolve({ rich: bind('post.title') });
    expect(props['rich']).toMatchObject({ type: 'root' });
  });

  it('falls back through fallback then default, tagging diagnostics with node and prop', () => {
    const missing = resolve({ title: bind('post.nope', { fallback: 'Fallback' }) });
    expect(missing.props['title']).toBe('Fallback');
    expect(missing.diagnostics).toEqual([
      expect.objectContaining({
        code: 'binding.missing',
        details: expect.objectContaining({ nodeId: NODE_ID, prop: 'title' }),
      }),
    ]);

    const noFallback = resolve({ title: bind('post.nope') });
    expect(noFallback.props['title']).toBe('Untitled');

    const nullValue = resolve({ title: bind('post.nothing', { fallback: 'F' }) });
    expect(nullValue.props['title']).toBe('F');
    expect(resolve({ title: bind('post.nothing') }).props['title']).toBe('Untitled');
  });

  it('falls back on a type mismatch', () => {
    const { props, diagnostics } = resolve({ count: bind('post.title', { fallback: 7 }) });
    expect(props['count']).toBe(7);
    expect(diagnostics[0]).toMatchObject({ code: 'binding.type-mismatch' });
  });

  it('sanitizes a dangerous URL from data', () => {
    const { props, diagnostics } = resolve({ href: bind('post.evil') });
    expect(props['href']).toBe('/home');
    expect(diagnostics.length).toBeGreaterThan(0);
  });

  it('caps over-long bound text', () => {
    const { props } = resolve({ title: bind('big') }, makeCtx({ big: 'y'.repeat(50) }));
    expect(props['title']).toBe('y'.repeat(10));
  });

  it('refuses prototype paths', () => {
    const { props, diagnostics } = resolve({ title: bind('__proto__.x') });
    expect(props['title']).toBe('Untitled');
    expect(diagnostics.length).toBeGreaterThan(0);
  });

  it('refuses to bind a prop kind that is not bindable', () => {
    for (const prop of ['size', 'icon']) {
      const { props, diagnostics } = resolve({ [prop]: bind('post.title') });
      expect(props[prop]).toBe(prop === 'size' ? 'm' : 'star');
      expect(diagnostics[0]?.code).toBe('binding.not-bindable');
    }
    const locked = meta({ t: p.text({ default: 'd', bindable: false }) });
    expect(resolve({ t: bind('post.title') }, makeCtx(DATA), locked).props['t']).toBe('d');
  });
});

describe('resolveProps: expressions', () => {
  it('evaluates formulas and coerces the result', () => {
    const { props, diagnostics } = resolve({
      title: expr('upper(post.title)'),
      count: expr('post.views * 2'),
      shown: expr('post.views > 1000'),
      body: expr('post.views'),
    });
    expect(props).toMatchObject({ title: 'HELLO', count: 2469, shown: true, body: '1,234.5' });
    expect(diagnostics).toEqual([]);
  });

  it('evaluates templates', () => {
    const { props } = resolve({
      body: expr('{{ post.title }} ({{ post.views }})', { mode: 'template' }),
    });
    expect(props['body']).toBe('Hello (1234.5)');
  });

  it('falls back on a syntax error, an unknown function and a type mismatch', () => {
    for (const source of ['1 +', 'nope(1)', 'post.views']) {
      const { props, diagnostics } = resolve({ title: expr(source, { fallback: 'F' }) });
      expect(props['title']).toBe(source === 'post.views' ? '1,234.5'.slice(0, 10) : 'F');
      if (source !== 'post.views') {
        expect(diagnostics[0]).toMatchObject({
          severity: 'error',
          details: expect.objectContaining({ nodeId: NODE_ID, prop: 'title' }),
        });
      }
    }
  });

  it('turns a null result into the fallback and then the default, with warnings kept', () => {
    const div = resolve({ count: expr('1 / 0', { fallback: 5 }) });
    expect(div.props['count']).toBe(5);
    expect(div.diagnostics[0]?.code).toBe('expr.division-by-zero');
    expect(resolve({ count: expr('1 / 0') }).props['count']).toBe(0);
  });

  it('uses a compile cache when given one', () => {
    const cache = createCompileCache();
    const options = { cache };
    resolveProps(node({ title: expr('upper(post.title)') }), META, makeCtx(DATA), options);
    resolveProps(node({ title: expr('upper(post.title)') }), META, makeCtx(DATA), options);
    expect(cache.size()).toBe(1);
  });

  it('cannot reach prototypes or run code', () => {
    const { props } = resolve({ title: expr('constructor.name'), body: expr('eval("1")') });
    expect(props['title']).toBe('Untitled');
    expect(props['body']).toBe('');
  });
});

describe('resolveProps: localization', () => {
  const pl = makeCtx(DATA, { locale: 'pl' });
  const plStrict = makeCtx(DATA, {
    locale: 'pl',
    locales: { default: 'en', fallback: false, intl: {} },
  });

  it('picks the translation for a localizable static value', () => {
    const value = withTranslation(s('Hello'), 'pl', 'Cześć');
    expect(resolve({ title: value }, pl).props['title']).toBe('Cześć');
    expect(resolve({ title: value }).props['title']).toBe('Hello');
  });

  it('falls back to the default-locale value when fallback is on', () => {
    const { props, diagnostics } = resolve({ title: s('Hello') }, pl);
    expect(props['title']).toBe('Hello');
    expect(diagnostics).toEqual([]);
  });

  it('uses the prop default and warns when fallback is off and there is no translation', () => {
    const { props, diagnostics } = resolve({ title: s('Hello') }, plStrict);
    expect(props['title']).toBe('Untitled');
    expect(diagnostics[0]).toMatchObject({
      code: 'l10n.missing-translation',
      details: expect.objectContaining({ prop: 'title' }),
    });
  });

  it('ignores translations on a non-localizable prop', () => {
    const value = withTranslation(s('X'), 'pl', 'Y');
    expect(resolve({ fixed: value }, pl).props['fixed']).toBe('X');
  });

  it('selects the per-locale template source', () => {
    const value = expr('Hi {{ post.title }}', {
      mode: 'template',
      l10n: { pl: 'Cześć {{ post.title }}' },
    });
    expect(resolve({ body: value }, pl).props['body']).toBe('Cześć Hello');
    expect(resolve({ body: value }).props['body']).toBe('Hi Hello');
    expect(resolve({ body: value }, plStrict).props['body']).toBe('Cześć Hello');
    const noPl = expr('Hi', { mode: 'template' });
    expect(resolve({ body: noPl }, pl).props['body']).toBe('Hi');
    const strict = resolve({ body: noPl }, plStrict);
    expect(strict.props['body']).toBe('');
    expect(strict.diagnostics[0]?.code).toBe('l10n.missing-translation');
  });

  it('never reads an inherited key of l10n', () => {
    const value = { kind: 'static', value: 'Hello', l10n: {} };
    const ctx = makeCtx(DATA, { locale: 'constructor' });
    expect(resolve({ title: value }, ctx).props['title']).toBe('Hello');
  });
});

describe('resolveProps: result shape', () => {
  it('is fully serializable', () => {
    const { props, diagnostics } = resolve({
      title: bind('post.title'),
      cover: bind('post.cover'),
      rich: bind('post.title'),
      count: expr('post.views'),
    });
    expect(JSON.parse(JSON.stringify({ props, diagnostics }))).toEqual({ props, diagnostics });
  });

  it('cannot be polluted through a prop named __proto__', () => {
    const m = meta({ ['__proto__']: p.text({ default: 'd' }) });
    const { props } = resolve({}, makeCtx(DATA), m);
    expect(Object.getPrototypeOf(props)).toBe(Object.prototype);
    expect(Object.hasOwn(props, '__proto__')).toBe(true);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('never throws, whatever the node holds', () => {
    const jsonArb = fc.jsonValue();
    const valueArb = fc.oneof(
      jsonArb,
      fc.record({ kind: fc.constant('static'), value: jsonArb, l10n: jsonArb }),
      fc.record({ kind: fc.constant('binding'), path: fc.string(), fallback: jsonArb }),
      fc.record({
        kind: fc.constant('expression'),
        expr: fc.string(),
        mode: fc.constantFrom('formula', 'template', 'other'),
        fallback: jsonArb,
      }),
    );
    fc.assert(
      fc.property(
        fc.record({
          title: valueArb,
          count: valueArb,
          shown: valueArb,
          href: valueArb,
          rich: valueArb,
          cover: valueArb,
          source: valueArb,
          size: valueArb,
        }),
        fc.constantFrom('en', 'pl', '__proto__'),
        (props, locale) => {
          const result = resolveProps(node(props), META, makeCtx(DATA, { locale }));
          expect(() => JSON.stringify(result)).not.toThrow();
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe('resolveVisibility', () => {
  const visible = (visibleIf: unknown, ctx = makeCtx(DATA)) =>
    resolveVisibility(node({}, { visibleIf } as Partial<PageNode>), ctx);

  it('is visible without a condition', () => {
    expect(resolveVisibility(node({}), makeCtx())).toEqual({ visible: true, diagnostics: [] });
  });

  it.each([
    [bind('post.featured'), true],
    [bind('post.title'), true],
    [bind('post.nothing'), false],
    [bind('post.nope'), false],
    [expr('post.views > 1000'), true],
    [expr('post.views > 5000'), false],
    [expr('!post.featured'), false],
    [expr('post.nope ?? false'), false],
    [s(true), true],
    [s(false), false],
  ])('%j', (condition, expected) => {
    expect(visible(condition).visible).toBe(expected);
  });

  it('hides the node and tags the diagnostic when the condition is broken', () => {
    for (const condition of [expr('1 +'), expr('nope()'), { kind: 'wat' }, 'yes']) {
      const result = visible(condition);
      expect(result.visible).toBe(false);
      expect(result.diagnostics[0]?.details).toMatchObject({ nodeId: NODE_ID, prop: 'visibleIf' });
    }
  });

  it('reports a missing binding while hiding', () => {
    const result = visible(bind('post.nope'));
    expect(result.diagnostics[0]).toMatchObject({ code: 'binding.missing' });
  });

  it('uses the compile cache and never throws', () => {
    const cache = createCompileCache();
    const condition = expr('post.featured');
    expect(
      resolveVisibility(node({}, { visibleIf: condition } as never), makeCtx(DATA), { cache })
        .visible,
    ).toBe(true);
    expect(cache.size()).toBe(1);
    fc.assert(
      fc.property(fc.jsonValue(), (value) => {
        expect(() => visible(value)).not.toThrow();
      }),
    );
  });
});
