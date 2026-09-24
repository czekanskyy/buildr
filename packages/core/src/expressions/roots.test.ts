import { describe, expect, it } from 'vitest';
import { parseExpression } from './parser.ts';
import { collectPathRoots } from './roots.ts';
import { parseTemplate } from './template.ts';

const roots = (source: string) => {
  const parsed = parseExpression(source);
  if (!parsed.ok) throw new Error('parse');
  return [...collectPathRoots(parsed.value)].sort();
};

describe('collectPathRoots', () => {
  it.each([
    ['1 + 2', []],
    ['post.title', ['post']],
    ['a.b + c[0] * d', ['a', 'c', 'd']],
    ['upper(x.y) + lower(z)', ['x', 'z']],
    ['a ? b : c', ['a', 'b', 'c']],
    ['a && !b || c ?? d', ['a', 'b', 'c', 'd']],
    ['[a, [b]]', ['a', 'b']],
    ['-a', ['a']],
    ['(a ? b : c).x', ['a', 'b', 'c']],
    ["a['k'].m", ['a']],
  ])('%s', (source, expected) => {
    expect(roots(source)).toEqual(expected);
  });

  it('reads every interpolation of a template', () => {
    const parsed = parseTemplate('Hi {{ a.b }} and {{ upper(c) }}, plain text');
    if (!parsed.ok) throw new Error('parse');
    expect([...collectPathRoots(parsed.value)].sort()).toEqual(['a', 'c']);
  });
});
