import { describe, expect, it } from 'vitest';
import { parseEditorRoute } from './editor-route.ts';

describe('parseEditorRoute', () => {
  it('reads the seed and the theme', () => {
    expect(parseEditorRoute('?seed=landing&theme=dark')).toEqual({
      seed: 'landing',
      theme: 'dark',
    });
    expect(parseEditorRoute('?seed=empty')).toEqual({ seed: 'empty', theme: undefined });
  });

  it('is the plain playground without parameters', () => {
    expect(parseEditorRoute('')).toEqual({ seed: undefined, theme: undefined });
  });

  it.each(['', 'x', 'Landing', '__proto__'])('ignores the value %j', (value) => {
    expect(parseEditorRoute(`?seed=${value}&theme=${value}`)).toEqual({
      seed: undefined,
      theme: undefined,
    });
  });
});
