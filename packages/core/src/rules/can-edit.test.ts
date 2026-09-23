import { describe, expect, it } from 'vitest';
import { createIndex } from '../document/document-index.ts';
import type {
  BuilderDocument,
  ComponentType,
  NodeId,
  PageNode,
  SlotName,
} from '../document/types.ts';
import { canEdit } from './can-edit.ts';

function node(
  id: NodeId,
  type: ComponentType,
  slots?: Readonly<Record<SlotName, readonly NodeId[]>>,
  extra: Partial<PageNode> = {},
): PageNode {
  return { id, type, ...(slots !== undefined ? { slots } : {}), ...extra };
}

function buildDoc(
  nodes: Record<NodeId, PageNode>,
  rootChildren: readonly NodeId[],
): BuilderDocument {
  return {
    schemaVersion: 1,
    root: 'root',
    nodes: { root: node('root', 'buildr/page', { default: rootChildren }), ...nodes },
    components: {},
  };
}

describe('canEdit', () => {
  it('allows editing content on an unlocked node', () => {
    const doc = buildDoc({ text: node('text', 'buildr/text') }, ['text']);
    expect(canEdit(doc, createIndex(doc), 'text', 'content')).toEqual({ ok: true, value: true });
  });

  it('allows editing style on an unlocked node', () => {
    const doc = buildDoc({ text: node('text', 'buildr/text') }, ['text']);
    expect(canEdit(doc, createIndex(doc), 'text', 'style')).toEqual({ ok: true, value: true });
  });

  it('rejects editing content on a node whose content is locked', () => {
    const doc = buildDoc(
      { text: node('text', 'buildr/text', undefined, { lock: { content: true } }) },
      ['text'],
    );
    const result = canEdit(doc, createIndex(doc), 'text', 'content');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('locked-content');
  });

  it('rejects editing style on a node whose style is locked, independent of content', () => {
    const doc = buildDoc(
      { text: node('text', 'buildr/text', undefined, { lock: { style: true } }) },
      ['text'],
    );
    expect(canEdit(doc, createIndex(doc), 'text', 'content')).toEqual({ ok: true, value: true });
    const result = canEdit(doc, createIndex(doc), 'text', 'style');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('locked-style');
  });

  it("inherits a lock from an ancestor's own content/style flag", () => {
    const doc = buildDoc(
      {
        section: node(
          'section',
          'buildr/section',
          { default: ['text'] },
          { lock: { content: true } },
        ),
        text: node('text', 'buildr/text'),
      },
      ['section'],
    );
    const result = canEdit(doc, createIndex(doc), 'text', 'content');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('locked-content');
  });

  it('reopens an inherited content lock through a region', () => {
    const doc = buildDoc(
      {
        section: node(
          'section',
          'buildr/section',
          { default: ['stack'] },
          { lock: { content: true } },
        ),
        stack: node('stack', 'buildr/stack', { default: ['text'] }, { region: 'freeform' }),
        text: node('text', 'buildr/text'),
      },
      ['section'],
    );
    expect(canEdit(doc, createIndex(doc), 'text', 'content')).toEqual({ ok: true, value: true });
  });

  it('rejects editing a node that does not exist', () => {
    const doc = buildDoc({}, []);
    const result = canEdit(doc, createIndex(doc), 'missing', 'content');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('node-not-found');
  });
});
