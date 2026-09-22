import { describe, expect, it } from 'vitest';
import { categoryOf, isCategoryMatcher, isValidContentCategory, matchesType } from './matchers.ts';

describe('isCategoryMatcher', () => {
  it('is true for a #category matcher', () => {
    expect(isCategoryMatcher('#heading')).toBe(true);
  });

  it('is false for a plain type matcher', () => {
    expect(isCategoryMatcher('buildr/heading')).toBe(false);
  });
});

describe('categoryOf', () => {
  it('strips the leading #', () => {
    expect(categoryOf('#heading')).toBe('heading');
  });
});

describe('isValidContentCategory', () => {
  it('accepts every documented category', () => {
    for (const category of [
      'flow',
      'phrasing',
      'heading',
      'interactive',
      'form-control',
      'list-item',
      'landmark',
      'media',
    ]) {
      expect(isValidContentCategory(category)).toBe(true);
    }
  });

  it('rejects an unknown category', () => {
    expect(isValidContentCategory('bogus')).toBe(false);
  });
});

describe('matchesType', () => {
  it('matches an exact type matcher', () => {
    expect(matchesType('buildr/heading', 'buildr/heading', [])).toBe(true);
  });

  it('does not match a different exact type', () => {
    expect(matchesType('buildr/heading', 'buildr/text', [])).toBe(false);
  });

  it('matches a category matcher when the type carries that category', () => {
    expect(matchesType('#heading', 'buildr/heading', ['flow', 'heading'])).toBe(true);
  });

  it('does not match a category matcher when the type lacks that category', () => {
    expect(matchesType('#interactive', 'buildr/heading', ['flow', 'heading'])).toBe(false);
  });
});
