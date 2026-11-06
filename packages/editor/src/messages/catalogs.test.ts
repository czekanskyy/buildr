import { expect, it } from 'vitest';
import { en } from './en.ts';
import { pl } from './pl.ts';

it('keeps English and Polish catalog key sets identical', () => {
  expect(Object.keys(pl).sort()).toEqual(Object.keys(en).sort());
});
