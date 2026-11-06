import { describe, expect, it } from 'vitest';
import { authorCodeFromSearch, parseEditorRoute } from './editor-route.ts';

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

  it('selects only supported UI catalogs for localized feedback fixtures', () => {
    expect(parseEditorRoute('?seed=landing&theme=light&uiLocale=pl')).toEqual({
      seed: 'landing',
      theme: 'light',
      uiLocale: 'pl',
    });
    expect(parseEditorRoute('?uiLocale=__proto__')).toEqual({ seed: undefined, theme: undefined });
  });

  it.each(['', 'x', 'Landing', '__proto__'])('ignores the value %j', (value) => {
    expect(parseEditorRoute(`?seed=${value}&theme=${value}`)).toEqual({
      seed: undefined,
      theme: undefined,
    });
  });
});

describe('authorCodeFromSearch', () => {
  it('is on unless it is switched off with authorCode=0', () => {
    expect(authorCodeFromSearch('')).toBe(true);
    expect(authorCodeFromSearch('?seed=landing')).toBe(true);
    expect(authorCodeFromSearch('?authorCode=1')).toBe(true);
    expect(authorCodeFromSearch('?authorCode=0')).toBe(false);
  });
});
