import type { BuilderDocument } from '@next-buildr/core';
import { describe, expect, it } from 'vitest';
import { isNodeStructureLocked, structureLockedIds } from './structure-lock.ts';

const doc: BuilderDocument = {
  schemaVersion: 1,
  root: 'root',
  nodes: {
    root: { id: 'root', type: 'buildr/page', slots: { default: ['lockedAAA1', 'openAAAA11'] } },
    lockedAAA1: {
      id: 'lockedAAA1',
      type: 'buildr/box',
      lock: { structure: true },
      slots: { default: ['innerAAAA11', 'regionAAA1'] },
    },
    innerAAAA11: { id: 'innerAAAA11', type: 'buildr/box' },
    regionAAA1: {
      id: 'regionAAA1',
      type: 'buildr/box',
      region: 'main',
      slots: { default: ['inRegion001'] },
    },
    inRegion001: { id: 'inRegion001', type: 'buildr/box' },
    openAAAA11: { id: 'openAAAA11', type: 'buildr/box', lock: { content: true, style: true } },
  },
  components: {},
};

describe('isNodeStructureLocked', () => {
  it('is true for the locked node itself', () => {
    expect(isNodeStructureLocked(doc, 'lockedAAA1')).toBe(true);
  });

  it('is true for a node inside a locked one', () => {
    expect(isNodeStructureLocked(doc, 'innerAAAA11')).toBe(true);
  });

  it('is false for a node locked only for content or style, and for an unlocked one', () => {
    expect(isNodeStructureLocked(doc, 'openAAAA11')).toBe(false);
    expect(isNodeStructureLocked(doc, 'root')).toBe(false);
  });

  it('does not reach into an editable region of a locked block', () => {
    expect(isNodeStructureLocked(doc, 'inRegion001')).toBe(false);
  });

  it('is false for an id that is not in the document', () => {
    expect(isNodeStructureLocked(doc, 'missingAAA1')).toBe(false);
  });

  it('filters ids', () => {
    expect(structureLockedIds(doc, ['openAAAA11', 'innerAAAA11', 'lockedAAA1'])).toEqual([
      'innerAAAA11',
      'lockedAAA1',
    ]);
  });
});
