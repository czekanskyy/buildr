import { describe, expect, it } from 'vitest';
import { createEmptyDocument } from './create.ts';
import { parseDocument } from './parse.ts';
import { ROOT_COMPONENT_TYPE } from './types.ts';

describe('createEmptyDocument', () => {
  it('produces a document with only a root node', () => {
    const doc = createEmptyDocument();
    expect(doc.schemaVersion).toBe(1);
    expect(doc.root).toBe('root');
    expect(Object.keys(doc.nodes)).toEqual(['root']);
    expect(doc.nodes.root).toEqual({ id: 'root', type: ROOT_COMPONENT_TYPE });
    expect(doc.components).toEqual({ [ROOT_COMPONENT_TYPE]: 1 });
  });

  it('passes parseDocument', () => {
    const result = parseDocument(createEmptyDocument());
    expect(result.ok).toBe(true);
  });
});
