import { toManifest } from '@buildr/core';
import { BuilderEditor, type DocumentAdapter } from '@buildr/editor';
import '@buildr/editor/styles.css';
import { demoRegistry } from '@buildr/test-utils/demo/components';
import { useMemo } from 'react';

/** A placeholder until the playground gets its in-memory backend (PB-092): nothing is stored. */
const adapter: DocumentAdapter = {
  getSession: async () => ({ canEdit: true, canPublish: false }),
  load: () => Promise.reject(new Error('the playground has no backend yet')),
  save: async (_ref, { baseRevision }) => ({
    ok: true,
    revision: baseRevision + 1,
    updatedAt: new Date().toISOString(),
  }),
  publish: async (_ref, { baseRevision }) => ({
    ok: true,
    revision: baseRevision + 1,
    updatedAt: new Date().toISOString(),
  }),
  getDataSchema: async () => ({ scopes: {}, entities: {} }),
  getContext: () => Promise.reject(new Error('the playground has no data context yet')),
  media: { search: async () => ({ items: [] }) },
  previewUrl: () => '/',
};

/** The editor shell in the playground (`/editor`); the panels arrive with the editor tasks (PB-074 onwards). */
export function EditorPage() {
  const manifest = useMemo(() => toManifest(demoRegistry.meta), []);
  return (
    <div style={{ height: '100vh' }}>
      <BuilderEditor
        adapter={adapter}
        manifest={manifest}
        canvasUrl="/canvas"
        documentRef={{ collection: 'pages', id: 'playground' }}
      />
    </div>
  );
}
