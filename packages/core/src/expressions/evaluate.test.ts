import { describe, expect, it } from 'vitest';
import type { DataContext } from '../data/context.ts';
import type { JsonValue } from '../json/json-value.ts';
import type { Diagnostic } from '../result/diagnostic.ts';
import type { ExprNode } from './ast.ts';
import { compileExpression, compileTemplate, createCompileCache } from './compile.ts';
import { evaluate, evaluateTemplate, MAX_EVALUATION_STEPS } from './evaluate.ts';
import { parseExpression } from './parser.ts';

function makeCtx(scopes: Record<string, JsonValue> = {}, locale = 'en'): DataContext {
  return {
    scopes,
    locale,
    locales: { default: 'en', fallback: true, intl: { en: 'en', pl: 'pl' } },
    timeZone: 'UTC',
    mode: 'production',
  };
}

const DATA: Record<string, JsonValue> = {
  post: { title: 'Hello', views: 1500, tags: ['a', 'b', 'c'], author: null },
  n: 5,
  zero: 0,
  name: 'Łódź Café',
  pl: { one: 'wpis', few: 'wpisy', many: 'wpisów', other: 'wpisu' },
};

function run(source: string, scopes = DATA, locale = 'en') {
  const parsed = parseExpression(source);
  if (!parsed.ok) throw new Error(`parse failed: ${parsed.error.message}`);
  const diagnostics: Diagnostic[] = [];
  const result = evaluate(parsed.value, makeCtx(scopes, locale), { diagnostics });
  return { result, diagnostics };
}

function value(source: string, scopes = DATA, locale = 'en'): JsonValue {
  const { result } = run(source, scopes, locale);
  if (!result.ok) throw new Error(`evaluation failed: ${result.error.message}`);
  return result.value;
}

describe('operators', () => {
  it.each([
    ['1 + 2 * 3', 7],
    ['(1 + 2) * 3', 9],
    ['10 % 4', 2],
    ['-n', -5],
    ['-zero', 0],
    ['"a" + 1', 'a1'],
    ['1 + "a"', '1a'],
    ['"a" + null', 'a'],
    ['"a" + true', 'atrue'],
    ['null + 1', null],
    ['1 == 1', true],
    ['1 == "1"', false],
    ['[1, [2]] == [1, [2]]', true],
    ['1 != 2', true],
    ['1 < 2', true],
    ['"a" < "b"', true],
    ['2 >= 3', false],
    ['null > 1', false],
    ['!null', true],
    ['!"x"', false],
    ['1 && "x"', true],
    ['0 || ""', false],
    ['null ?? "d"', 'd'],
    ['0 ?? "d"', 0],
    ['n > 3 ? "big" : "small"', 'big'],
    ['[1, 2, n]', [1, 2, 5]],
  ])('%s', (source, expected) => {
    expect(value(source)).toEqual(expected);
  });

  it('returns a boolean from && and || rather than an operand', () => {
    expect(value('"a" && "b"')).toBe(true);
    expect(value('"" || "b"')).toBe(true);
  });

  it('short-circuits, so the skipped side never warns', () => {
    const { diagnostics } = run('false && 1 / 0 > 1');
    expect(diagnostics).toEqual([]);
  });

  it('yields null and a diagnostic for division by zero', () => {
    for (const source of ['1 / 0', '1 % 0', 'n / zero']) {
      const { result, diagnostics } = run(source);
      expect(result).toEqual({ ok: true, value: null });
      expect(diagnostics.map((d) => d.code)).toEqual(['expr.division-by-zero']);
      expect(diagnostics[0]?.severity).toBe('warning');
    }
  });

  it('warns on mismatched operands and overflow', () => {
    expect(run('"a" - 1').diagnostics[0]?.code).toBe('expr.type-mismatch');
    expect(run('1 < "a"').diagnostics[0]?.code).toBe('expr.type-mismatch');
    expect(run('-"a"').diagnostics[0]?.code).toBe('expr.type-mismatch');
    expect(run('[1] + "a"').diagnostics[0]?.code).toBe('expr.type-mismatch');
    const overflow = run('1e308 * 10');
    expect(overflow.result).toEqual({ ok: true, value: null });
    expect(overflow.diagnostics[0]?.code).toBe('expr.not-finite');
  });

  it('never produces negative zero', () => {
    expect(Object.is(value('0 * -1'), 0)).toBe(true);
  });
});

describe('paths', () => {
  it.each([
    ['post.title', 'Hello'],
    ['post.tags[1]', 'b'],
    ["post['title']", 'Hello'],
    ['post.author.name', null],
    ['missing.deeper', null],
    ['post.tags[9]', null],
    ['(n > 1 ? post : null).title', 'Hello'],
    ['[10, 20][1]', 20],
  ])('%s', (source, expected) => {
    const { result, diagnostics } = run(source);
    expect(result).toEqual({ ok: true, value: expected });
    expect(diagnostics).toEqual([]);
  });

  it.each(['__proto__', 'constructor', 'post.constructor', 'post.__proto__.x', 'a.prototype'])(
    'never reads %s',
    (source) => {
      const { result, diagnostics } = run(source, { ...DATA, a: {} });
      expect(result).toEqual({ ok: true, value: null });
      expect(diagnostics.length).toBeGreaterThan(0);
    },
  );

  it('does not read inherited properties', () => {
    expect(value('toString')).toBeNull();
    expect(value("post['hasOwnProperty']")).toBeNull();
  });

  it('warns on a step that is not an identifier', () => {
    const { result, diagnostics } = run("post['a.b']");
    expect(result).toEqual({ ok: true, value: null });
    expect(diagnostics[0]?.code).toBe('expr.path-invalid');
  });
});

describe('calls', () => {
  it('fails on an unknown function, including prototype names', () => {
    for (const source of ['nope(1)', 'constructor(1)', 'toString()', '__proto__(1)']) {
      const { result } = run(source);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('expr.unknown-function');
    }
  });

  it('fails on a wrong argument count with the span', () => {
    for (const source of ['upper()', 'upper("a", "b")', 'round(1, 2, 3)', 'min()']) {
      const { result } = run(source);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('expr.arity');
        expect(result.error.details).toEqual({ start: 0, end: source.length });
      }
    }
  });

  it('warns on a wrong argument type and propagates null quietly', () => {
    expect(run('upper(1)').diagnostics[0]?.code).toBe('expr.type-mismatch');
    expect(value('upper(1)')).toBeNull();
    const quiet = run('upper(missing)');
    expect(quiet.result).toEqual({ ok: true, value: null });
    expect(quiet.diagnostics).toEqual([]);
  });

  it('evaluates only the chosen branch of if and coalesce', () => {
    expect(run('if(n != 0, 10 / n, 0)').diagnostics).toEqual([]);
    expect(run('if(zero != 0, 10 / zero, 0)')).toMatchObject({ result: { ok: true, value: 0 } });
    expect(run('if(zero != 0, 10 / zero, 0)').diagnostics).toEqual([]);
    expect(run('coalesce(1, 1 / 0)').diagnostics).toEqual([]);
  });
});

describe('stdlib: text', () => {
  it.each([
    ['upper("aé")', 'AÉ'],
    ['lower("AÉ")', 'aé'],
    ['capitalize("élan")', 'Élan'],
    ['capitalize("")', ''],
    ['trim("  a b ")', 'a b'],
    ['truncate("abcdef", 4)', 'abc…'],
    ['truncate("abcdef", 4, "..")', 'ab..'],
    ['truncate("abc", 4)', 'abc'],
    ['truncate("abcdef", 0)', ''],
    ['truncate("😀😀😀", 3, "")', '😀'],
    ['concat("a", 1, null, true)', 'a1true'],
    ['replace("a.b.c", ".", "-")', 'a-b-c'],
    ['replace("abc", "", "x")', 'abc'],
    ['replace("a+b", "+", "$&")', 'a$&b'],
    ['slugify(name)', 'lodz-cafe'],
    ['slugify("  --Hello,  World!-- ")', 'hello-world'],
    ['len("abc")', 3],
    ['len(post.tags)', 3],
    ['len(missing)', 0],
  ])('%s', (source, expected) => {
    expect(value(source)).toEqual(expected);
  });

  it('warns on invalid arguments', () => {
    expect(run('truncate("abc", -1)').diagnostics[0]?.code).toBe('expr.invalid-argument');
    expect(run('concat([1])').diagnostics[0]?.code).toBe('expr.invalid-argument');
    expect(run('len(1)').diagnostics[0]?.code).toBe('expr.invalid-argument');
  });
});

describe('stdlib: number', () => {
  it.each([
    ['round(2.5)', 3],
    ['round(-2.5)', -3],
    ['round(1.005, 2)', 1.01],
    ['round(1.2345, 2)', 1.23],
    ['floor(-1.5)', -2],
    ['ceil(1.2)', 2],
    ['abs(-3)', 3],
    ['min(3, 1, 2)', 1],
    ['max(3, 1, 2)', 3],
    ['clamp(15, 0, 10)', 10],
    ['clamp(-5, 0, 10)', 0],
    ['clamp(5, 0, 10)', 5],
  ])('%s', (source, expected) => {
    expect(value(source)).toEqual(expected);
  });

  it('warns on invalid arguments', () => {
    expect(run('round(1, 1.5)').diagnostics[0]?.code).toBe('expr.invalid-argument');
    expect(run('round(1, 21)').diagnostics[0]?.code).toBe('expr.invalid-argument');
    expect(run('clamp(1, 10, 0)').diagnostics[0]?.code).toBe('expr.invalid-argument');
  });
});

describe('stdlib: formatting', () => {
  it('formats numbers, currency and dates by locale', () => {
    expect(value('formatNumber(1234.5)', DATA, 'en')).toBe('1,234.5');
    expect(value('formatNumber(1234.5)', DATA, 'pl')).toBe('1234,5');
    expect(value('formatNumber(0.256, opts)', { opts: { style: 'percent' } }, 'en')).toBe('26%');
    expect(value('formatNumber(1, opts)', { opts: { minimumFractionDigits: 2 } }, 'en')).toBe(
      '1.00',
    );
    expect(value('formatCurrency(9.5, "USD")', DATA, 'en')).toBe('$9.50');
    expect(value('formatDate("2026-03-05T12:00:00Z", "iso")')).toBe('2026-03-05T12:00:00.000Z');
    expect(value('formatDate("2026-03-05T12:00:00Z", "long")', DATA, 'en')).toBe('March 5, 2026');
    expect(value('formatDate(missing, "long")')).toBeNull();
  });

  it('warns on an invalid currency, date or option', () => {
    expect(run('formatCurrency(1, "nope")').diagnostics[0]?.code).toBe('expr.invalid-argument');
    expect(run('formatDate("garbage", "long")').diagnostics[0]?.code).toBe('expr.invalid-argument');
    expect(run('formatDate("2026-01-01", "weird")').diagnostics[0]?.code).toBe(
      'expr.invalid-argument',
    );
    expect(run('formatNumber(1, o)', { o: { style: 'currency' } }).diagnostics[0]?.code).toBe(
      'expr.invalid-argument',
    );
    expect(
      run('formatNumber(1, o)', { o: { maximumFractionDigits: 99 } }).diagnostics[0]?.code,
    ).toBe('expr.invalid-argument');
  });

  describe('plural', () => {
    it.each([
      [1, 'wpis'],
      [2, 'wpisy'],
      [3, 'wpisy'],
      [4, 'wpisy'],
      [5, 'wpisów'],
      [12, 'wpisów'],
      [13, 'wpisów'],
      [14, 'wpisów'],
      [22, 'wpisy'],
      [25, 'wpisów'],
      [112, 'wpisów'],
      [1.5, 'wpisu'],
    ])('Polish %s', (count, expected) => {
      expect(value('plural(c, pl)', { ...DATA, c: count }, 'pl')).toBe(expected);
    });

    it('uses English rules for en and falls back to other', () => {
      const forms = { one: 'post', other: 'posts' };
      expect(value('plural(c, f)', { c: 1, f: forms }, 'en')).toBe('post');
      expect(value('plural(c, f)', { c: 2, f: forms }, 'en')).toBe('posts');
      expect(value('plural(c, f)', { c: 5, f: { other: 'x', few: 'y' } }, 'pl')).toBe('x');
    });

    it('warns on a malformed forms table or an invalid locale', () => {
      expect(run('plural(1, f)', { f: { one: 'a' } }).diagnostics[0]?.code).toBe(
        'expr.invalid-argument',
      );
      expect(run('plural(1, f)', { f: { other: 1 } }).diagnostics[0]?.code).toBe(
        'expr.invalid-argument',
      );
      expect(run('plural(1, f)', { f: { other: 'a', many2: 'b' } }).diagnostics[0]?.code).toBe(
        'expr.invalid-argument',
      );
      expect(run('plural(1, f)', { f: { other: 'a' } }, 'not a locale!').diagnostics[0]?.code).toBe(
        'expr.invalid-argument',
      );
    });
  });
});

describe('stdlib: lists and logic', () => {
  it.each([
    ['count(post.tags)', 3],
    ['count(missing)', 0],
    ['first(post.tags)', 'a'],
    ['last(post.tags)', 'c'],
    ['first([])', null],
    ['last([])', null],
    ['join(post.tags, ", ")', 'a, b, c'],
    ['join([1, null, true], "-")', '1--true'],
    ['includes(post.tags, "b")', true],
    ['includes(post.tags, "z")', false],
    ['includes([[1]], [1])', true],
    ['slice(post.tags, 1)', ['b', 'c']],
    ['slice(post.tags, 0, 2)', ['a', 'b']],
    ['slice(post.tags, -1)', ['c']],
    ['if(n > 3, "y", "n")', 'y'],
    ['coalesce(missing, null, "x", "y")', 'x'],
    ['coalesce(missing)', null],
    ['isEmpty(missing)', true],
    ['isEmpty("")', true],
    ['isEmpty([])', true],
    ['isEmpty(0)', false],
    ['isEmpty(post.tags)', false],
    ['isEmpty(post)', false],
  ])('%s', (source, expected) => {
    expect(value(source)).toEqual(expected);
  });

  it('warns on invalid arguments', () => {
    expect(run('count(1)').diagnostics[0]?.code).toBe('expr.invalid-argument');
    expect(run('join([[1]], ",")').diagnostics[0]?.code).toBe('expr.invalid-argument');
    expect(run('slice(post.tags, 1.5)').diagnostics[0]?.code).toBe('expr.invalid-argument');
  });
});

describe('limits', () => {
  const literal = (v: number): ExprNode => ({ kind: 'Literal', value: v, span: [0, 1] });

  it('stops a shared-subtree AST that would take exponential steps', () => {
    let node: ExprNode = literal(1);
    for (let i = 0; i < 40; i += 1) {
      node = { kind: 'Binary', op: '+', left: node, right: node, span: [0, 1] };
    }
    const result = evaluate(node, makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('expr.limit');
  });

  it('honours a lower maxSteps but never exceeds the maximum', () => {
    const parsed = parseExpression('1 + 2 + 3');
    if (!parsed.ok) throw new Error('parse');
    expect(evaluate(parsed.value, makeCtx(), { maxSteps: 3 }).ok).toBe(false);
    expect(evaluate(parsed.value, makeCtx(), { maxSteps: 5 }).ok).toBe(true);
    expect(evaluate(parsed.value, makeCtx(), { maxSteps: 1e9 }).ok).toBe(true);
    expect(MAX_EVALUATION_STEPS).toBe(10_000);
  });

  it('rejects an AST nested beyond the evaluator depth instead of overflowing the stack', () => {
    let node: ExprNode = literal(1);
    for (let i = 0; i < 100_000; i += 1) {
      node = { kind: 'Unary', op: '!', operand: node, span: [0, 1] };
    }
    const result = evaluate(node, makeCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('expr.limit');
  });

  it('caps result text and list sizes', () => {
    const big = 'x'.repeat(6000);
    const text = run('a + a', { a: big }).result;
    expect(text.ok).toBe(false);
    if (!text.ok) expect(text.error.code).toBe('expr.limit');

    const long = Array.from({ length: 1001 }, (_, i) => i);
    const joined = run('join(l, ",")', { l: long }).result;
    expect(joined.ok).toBe(true);
    expect(run('join(l, ",")', { l: long }).diagnostics[0]?.code).toBe('expr.invalid-argument');
  });

  it('charges steps for work proportional to the input', () => {
    const parsed = parseExpression('replace(s, "a", "b")');
    if (!parsed.ok) throw new Error('parse');
    const result = evaluate(parsed.value, makeCtx({ s: 'a'.repeat(9000) }), { maxSteps: 5000 });
    expect(result.ok).toBe(false);
  });

  it('is fast for a typical expression', () => {
    const compiled = compileExpression('post.views > 1000 ? formatNumber(post.views) : "few"');
    if (!compiled.ok) throw new Error('compile');
    const ctx = makeCtx(DATA);
    compiled.value.evaluate(ctx);
    const started = performance.now();
    for (let i = 0; i < 1000; i += 1) compiled.value.evaluate(ctx);
    expect((performance.now() - started) / 1000).toBeLessThan(0.5);
  });
});

describe('templates', () => {
  it('interpolates and stringifies', () => {
    const compiled = compileTemplate('{{ upper(post.title) }}: {{ n }} {{ missing }}| \\{{ x }}');
    if (!compiled.ok) throw new Error('compile');
    expect(compiled.value.evaluate(makeCtx(DATA))).toEqual({
      ok: true,
      value: 'HELLO: 5 | {{ x }}',
    });
  });

  it('warns on a list and continues', () => {
    const compiled = compileTemplate('a{{ post.tags }}b');
    if (!compiled.ok) throw new Error('compile');
    const diagnostics: Diagnostic[] = [];
    expect(compiled.value.evaluate(makeCtx(DATA), { diagnostics })).toEqual({
      ok: true,
      value: 'ab',
    });
    expect(diagnostics[0]?.code).toBe('expr.type-mismatch');
  });

  it('fails fast on unknown functions and on oversized output', () => {
    const bad = compileTemplate('{{ nope() }}');
    if (!bad.ok) throw new Error('compile');
    expect(bad.value.evaluate(makeCtx()).ok).toBe(false);

    const parsed = compileTemplate('{{ a }}{{ a }}');
    if (!parsed.ok) throw new Error('compile');
    const result = evaluateTemplate(parsed.value.ast, makeCtx({ a: 'x'.repeat(6000) }));
    expect(result.ok).toBe(false);
  });
});

describe('compile cache', () => {
  it('returns the same compiled object for the same source and evicts the least recently used', () => {
    const cache = createCompileCache(2);
    const a = cache.expression('1');
    expect(cache.expression('1')).toBe(a);
    cache.expression('2');
    cache.expression('1'); // 1 is now most recent
    cache.expression('3'); // evicts 2
    expect(cache.expression('1')).toBe(a);
    expect(cache.size()).toBe(2);
    cache.template('x');
    expect(cache.size()).toBe(3);
    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it('caches parse failures and never throws', () => {
    const cache = createCompileCache();
    const bad = cache.expression('1 +');
    expect(bad.ok).toBe(false);
    expect(cache.expression('1 +')).toBe(bad);
    expect(cache.template('{{').ok).toBe(false);
  });

  it('evaluates through the compiled handle', () => {
    const compiled = createCompileCache().expression('n * 2');
    if (!compiled.ok) throw new Error('compile');
    expect(compiled.value.evaluate(makeCtx({ n: 4 }))).toEqual({ ok: true, value: 8 });
  });
});
