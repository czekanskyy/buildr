import {
  type BuilderDocument,
  createRegistryMeta,
  createSeededIdGenerator,
  type PageNode,
} from '@buildr/core';
import { describe, expect, it } from 'vitest';
import { createEditorStore } from './create-store.ts';
import { pathTo, relativeNode } from './selection.ts';
import { selectSelectedNode, selectSelectionPath } from './selectors.ts';

const node = (id: string, type: string, extra: Partial<PageNode> = {}): PageNode => ({
  id,
  type,
  ...extra,
});

const doc: BuilderDocument = {
  schemaVersion: 1,
  root: 'root',
  nodes: {
    root: node('root', 'buildr/page', { slots: { default: ['boxNode001', 'boxNode002'] } }),
    boxNode001: node('boxNode001', 'buildr/box', {
      slots: { default: ['textNodeA1', 'textNodeB1'] },
    }),
    boxNode002: node('boxNode002', 'buildr/box'),
    textNodeA1: node('textNodeA1', 'buildr/text'),
    textNodeB1: node('textNodeB1', 'buildr/text'),
  },
  components: {},
};

const create = () =>
  createEditorStore({
    doc,
    registry: createRegistryMeta({ components: [] }),
    generateId: createSeededIdGenerator(3),
    validationDelayMs: null,
  });

describe('selection', () => {
  it('replaces, toggles and adds; the anchor is the last node selected', () => {
    const store = create();
    store.select('textNodeA1', { instance: 'loop:2' });
    expect(store.getState().selectedIds).toEqual(['textNodeA1']);
    expect(store.getState().selectedInstance).toBe('loop:2');

    store.select('textNodeB1', { mode: 'add' });
    expect(store.getState().selectedIds).toEqual(['textNodeA1', 'textNodeB1']);
    expect(store.getState().anchorId).toBe('textNodeB1');
    expect(store.getState().selectedInstance).toBeUndefined();

    store.select('textNodeB1', { mode: 'toggle' });
    expect(store.getState().selectedIds).toEqual(['textNodeA1']);
    expect(store.getState().anchorId).toBe('textNodeA1');

    store.select('boxNode002');
    expect(store.getState().selectedIds).toEqual(['boxNode002']);
    store.clearSelection();
    expect(store.getState().selectedIds).toEqual([]);
    expect(store.getState().anchorId).toBeNull();
  });

  it('ignores a node the document does not have', () => {
    const store = create();
    store.select('ghost');
    expect(store.getState().selectedIds).toEqual([]);
  });

  it('drops a removed node from the selection and moves the anchor', () => {
    const store = create();
    store.select('textNodeA1');
    store.select('textNodeB1', { mode: 'add' });
    store.dispatch({ type: 'node.remove', payload: { ids: ['textNodeB1'] } });
    expect(store.getState().selectedIds).toEqual(['textNodeA1']);
    expect(store.getState().anchorId).toBe('textNodeA1');
    expect(selectSelectedNode(store.getState())?.id).toBe('textNodeA1');
  });

  it('moves to the parent, first child and siblings, and stops at the ends', () => {
    const store = create();
    store.select('boxNode001');
    expect(store.moveSelection('child')).toBe('textNodeA1');
    expect(store.moveSelection('next')).toBe('textNodeB1');
    expect(store.moveSelection('next')).toBeUndefined();
    expect(store.getState().anchorId).toBe('textNodeB1');
    expect(store.moveSelection('previous')).toBe('textNodeA1');
    expect(store.moveSelection('parent')).toBe('boxNode001');
    expect(store.moveSelection('parent')).toBe('root');
    expect(store.moveSelection('parent')).toBeUndefined();
    expect(store.moveSelection('child')).toBe('boxNode001');
  });

  it('does nothing without a selection', () => {
    expect(create().moveSelection('child')).toBeUndefined();
  });

  it('knows the path from the root', () => {
    expect(pathTo(doc, 'textNodeB1')).toEqual(['root', 'boxNode001', 'textNodeB1']);
    expect(pathTo(doc, 'root')).toEqual(['root']);
    expect(pathTo(doc, 'ghost')).toEqual([]);
    expect(relativeNode(doc, 'textNodeA1', 'previous')).toBeUndefined();
    const store = create();
    store.select('textNodeA1');
    expect(selectSelectionPath(store.getState())).toEqual(['root', 'boxNode001', 'textNodeA1']);
  });

  it('clears a hover on a node that is gone', () => {
    const store = create();
    store.setHovered('textNodeB1');
    store.dispatch({ type: 'node.remove', payload: { ids: ['textNodeB1'] } });
    expect(store.getState().hoveredId).toBeNull();
  });
});
