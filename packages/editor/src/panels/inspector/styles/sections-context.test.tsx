// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createSectionRegistry } from './section-state.ts';

describe('section registry', () => {
  it('is scoped to one inspector: another registry never sees or loses its sections', () => {
    const a = createSectionRegistry();
    const b = createSectionRegistry();
    const removeA = a.report('layout', true);
    const removeB = b.report('layout', false);
    expect(a.snapshot()).toEqual({ names: ['layout'], allOpen: true });
    expect(b.snapshot()).toEqual({ names: ['layout'], allOpen: false });
    removeB();
    expect(b.snapshot().names).toEqual([]);
    expect(a.snapshot()).toEqual({ names: ['layout'], allOpen: true });
    removeA();
    expect(a.snapshot().names).toEqual([]);
  });
});
