import { describe, expect, it } from 'vitest';
import type { DataSchema } from '../data/schema.ts';
import { parseExpression } from './parser.ts';
import { stdlib } from './stdlib/index.ts';
import { parseTemplate } from './template.ts';
import { typecheck } from './typecheck.ts';

const SCHEMA: DataSchema = {
  scopes: {
    post: {
      type: {
        t: 'object',
        fields: {
          title: { type: { t: 'string' } },
          views: { type: { t: 'number' } },
          featured: { type: { t: 'boolean' } },
          tags: { type: { t: 'list', of: { t: 'string' } } },
          publishedAt: { type: { t: 'date' } },
          author: { type: { t: 'ref', entity: 'author' } },
          cover: { type: { t: 'media' } },
          kind: { type: { t: 'enum', values: ['a', 'b'] } },
        },
      },
    },
    labels: {
      type: { t: 'object', fields: { posts: { type: { t: 'object', fields: {} } } } },
    },
  },
  entities: { author: { type: { t: 'object', fields: { name: { type: { t: 'string' } } } } } },
};

function check(source: string, schema: DataSchema | null = SCHEMA, accepts?: string[]) {
  const parsed = parseExpression(source);
  if (!parsed.ok) throw new Error(`parse failed: ${parsed.error.message}`);
  return typecheck(
    parsed.value,
    schema ?? undefined,
    accepts === undefined ? {} : { accepts: accepts as never },
  );
}

describe('typecheck: inferred types', () => {
  it.each([
    ['1', 'number'],
    ['"a"', 'string'],
    ['true', 'boolean'],
    ['null', 'null'],
    ['post.title', 'string'],
    ['post.views', 'number'],
    ['post.author.name', 'string'],
    ['post.tags[0]', 'string'],
    ['post.cover', 'media'],
    ['post.views + 1', 'number'],
    ['post.title + post.views', 'string'],
    ['post.publishedAt + ""', 'string'],
    ['post.views > 3', 'boolean'],
    ['post.title < "z"', 'boolean'],
    ['post.views == "x"', 'boolean'],
    ['!post.title', 'boolean'],
    ['post.views > 1 && post.featured', 'boolean'],
    ['-post.views', 'number'],
    ['post.featured ? 1 : 2', 'number'],
    ['post.featured ? 1 : "a"', 'unknown'],
    ['post.featured ? "a" : post.kind', 'string'],
    ['post.title ?? "x"', 'string'],
    ['null ?? 1', 'number'],
    ['upper(post.title)', 'string'],
    ['len(post.tags)', 'number'],
    ['first(post.tags)', 'string'],
    ['slice(post.tags, 1)', 'list'],
    ['join(post.tags, ",")', 'string'],
    ['if(post.featured, post.views, 0)', 'number'],
    ['coalesce(post.title, "x")', 'string'],
    ['plural(post.views, labels.posts)', 'string'],
    ['formatDate(post.publishedAt, "long")', 'string'],
    ['[1, 2]', 'list'],
    ['(post.featured ? post : post).title', 'unknown'],
  ])('%s is %s', (source, expected) => {
    const result = check(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.type.t).toBe(expected);
  });

  it('infers the element type of a list literal', () => {
    expect(check('[1, 2]').type).toEqual({ t: 'list', of: { t: 'number' } });
  });
});

describe('typecheck: errors', () => {
  it.each([
    ['post.nope', 'expr.unknown-path'],
    ['nope.x', 'expr.unknown-path'],
    ['post.title.length', 'expr.unknown-path'],
    ['post.__proto__', 'expr.unknown-path'],
    ['upper(post.nope)', 'expr.unknown-path'],
    ['nope(1)', 'expr.unknown-function'],
    ['constructor(1)', 'expr.unknown-function'],
    ['upper()', 'expr.arity'],
    ['round(1, 2, 3)', 'expr.arity'],
    ['upper(post.views)', 'expr.type-mismatch'],
    ['round(post.title)', 'expr.type-mismatch'],
    ['join(post.title, ",")', 'expr.type-mismatch'],
    ['first(post.views)', 'expr.type-mismatch'],
    ['post.title - 1', 'expr.type-mismatch'],
    ['post.featured * 2', 'expr.type-mismatch'],
    ['post.featured + 1', 'expr.type-mismatch'],
    ['post.tags + "a"', 'expr.type-mismatch'],
    ['post.tags + post.unknownish', 'expr.unknown-path'],
    ['-post.title', 'expr.type-mismatch'],
    ['post.title < 3', 'expr.type-mismatch'],
    ['post.views > post.title', 'expr.type-mismatch'],
  ])('%s → %s', (source, code) => {
    expect(check(source).diagnostics.map((d) => d.code)).toContain(code);
  });

  it('tags a diagnostic with the offending span and severity', () => {
    const [d] = check('1 + post.nope').diagnostics;
    expect(d).toMatchObject({
      code: 'expr.unknown-path',
      severity: 'error',
      details: { start: 4, end: 13 },
    });
    const arg = check('upper(post.views)').diagnostics[0];
    expect(arg?.details).toEqual({ start: 6, end: 16 });
  });

  it('reports every problem, not only the first', () => {
    expect(check('post.a + post.b').diagnostics).toHaveLength(2);
  });
});

describe('typecheck: no schema', () => {
  it('treats every path as unknown but still checks functions and arity', () => {
    expect(check('post.anything', null)).toMatchObject({
      type: { t: 'unknown' },
      diagnostics: [],
    });
    expect(check('upper(a) + b * 2', null).diagnostics).toEqual([]);
    expect(check('nope(a)', null).diagnostics[0]?.code).toBe('expr.unknown-function');
    expect(check('upper(a, b)', null).diagnostics[0]?.code).toBe('expr.arity');
    expect(check('"a" - 1', null).diagnostics[0]?.code).toBe('expr.type-mismatch');
  });
});

describe('typecheck: PropDef.accepts', () => {
  it('accepts a matching or unknown result', () => {
    expect(check('upper(post.title)', SCHEMA, ['string']).diagnostics).toEqual([]);
    expect(check('post.views', SCHEMA, ['number']).diagnostics).toEqual([]);
    expect(check('post.anything', null, ['boolean']).diagnostics).toEqual([]);
    expect(check('null', SCHEMA, ['boolean']).diagnostics).toEqual([]);
  });

  it('rejects an incompatible result with the whole-expression span', () => {
    const [d] = check('post.views + 1', SCHEMA, ['string', 'url']).diagnostics;
    expect(d).toMatchObject({
      code: 'expr.result-type',
      severity: 'error',
      details: { start: 0, end: 14 },
    });
    expect(check('post.views', SCHEMA, []).diagnostics[0]?.message).toContain('no bindings');
  });
});

describe('typecheck: templates', () => {
  function checkTemplate(
    source: string,
    schema: DataSchema | undefined = SCHEMA,
    accepts?: string[],
  ) {
    const parsed = parseTemplate(source);
    if (!parsed.ok) throw new Error('parse failed');
    return typecheck(
      parsed.value,
      schema,
      accepts === undefined ? {} : { accepts: accepts as never },
    );
  }

  it('is a string and checks each interpolation', () => {
    const ok = checkTemplate('{{ post.title }} has {{ post.views }} views, {{ post.featured }}');
    expect(ok).toMatchObject({ type: { t: 'string' }, diagnostics: [] });

    const bad = checkTemplate('{{ post.tags }} {{ post.nope }} {{ post.cover }}');
    expect(bad.diagnostics.map((d) => d.code)).toEqual([
      'expr.type-mismatch',
      'expr.unknown-path',
      'expr.type-mismatch',
    ]);
  });

  it('checks the result against accepts', () => {
    expect(checkTemplate('x', SCHEMA, ['string']).diagnostics).toEqual([]);
    expect(checkTemplate('x', SCHEMA, ['number']).diagnostics[0]?.code).toBe('expr.result-type');
  });
});

describe('stdlib signatures', () => {
  it('declare a result type for every function', () => {
    for (const fn of Object.values(stdlib)) {
      expect(fn.returns, fn.name).toBeDefined();
      expect(fn.doc.startsWith(`${fn.name}(`), fn.name).toBe(true);
    }
  });
});
