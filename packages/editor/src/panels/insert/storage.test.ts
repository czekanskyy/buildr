// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  COLLAPSED_KEY,
  RECENT_KEY,
  RECENT_LIMIT,
  readCollapsed,
  readRecent,
  withRecent,
  writeRecent,
} from './storage.ts';

afterEach(() => localStorage.clear());

describe('recently used', () => {
  it('reads a valid list and drops repeats', () => {
    localStorage.setItem(RECENT_KEY, JSON.stringify(['a', 'b', 'a']));
    expect(readRecent()).toEqual(['a', 'b']);
  });

  it('ignores corrupt data of every shape', () => {
    for (const raw of ['{oops', '{"a":1}', '"text"', '42', 'null']) {
      localStorage.setItem(RECENT_KEY, raw);
      expect(readRecent()).toEqual([]);
    }
    localStorage.setItem(RECENT_KEY, JSON.stringify(['a', 1, null, { x: 1 }, 'b']));
    expect(readRecent()).toEqual(['a', 'b']);
  });

  it('caps the list and moves a reused block to the front', () => {
    let list: string[] = [];
    for (let i = 0; i < RECENT_LIMIT + 3; i++) list = withRecent(list, `t${i}`);
    expect(list).toHaveLength(RECENT_LIMIT);
    expect(list[0]).toBe(`t${RECENT_LIMIT + 2}`);
    expect(withRecent(list, list[2] as string)[0]).toBe(list[2]);
    localStorage.setItem(RECENT_KEY, JSON.stringify(Array.from({ length: 50 }, (_, i) => `x${i}`)));
    expect(readRecent()).toHaveLength(RECENT_LIMIT);
  });

  it('survives storage that throws', () => {
    const original = Storage.prototype.getItem;
    const set = Storage.prototype.setItem;
    Storage.prototype.getItem = () => {
      throw new Error('blocked');
    };
    Storage.prototype.setItem = () => {
      throw new Error('blocked');
    };
    try {
      expect(readRecent()).toEqual([]);
      expect(readCollapsed().size).toBe(0);
      expect(() => writeRecent(['a'])).not.toThrow();
    } finally {
      Storage.prototype.getItem = original;
      Storage.prototype.setItem = set;
    }
  });

  it('reads the collapsed groups defensively', () => {
    localStorage.setItem(COLLAPSED_KEY, 'not json');
    expect(readCollapsed().size).toBe(0);
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(['components:media', 3]));
    expect([...readCollapsed()]).toEqual(['components:media']);
  });
});
