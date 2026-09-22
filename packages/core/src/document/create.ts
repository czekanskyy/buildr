import { type BuilderDocument, ROOT_COMPONENT_TYPE } from './types.ts';

/** A minimal, valid document: a root page node with no children. */
export function createEmptyDocument(): BuilderDocument {
  return {
    schemaVersion: 1,
    root: 'root',
    nodes: {
      root: { id: 'root', type: ROOT_COMPONENT_TYPE },
    },
    components: { [ROOT_COMPONENT_TYPE]: 1 },
  };
}
