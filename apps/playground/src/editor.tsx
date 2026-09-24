import { toManifest } from '@buildr/core';
import { BuilderEditor } from '@buildr/editor';
import '@buildr/editor/styles.css';
import { demoRegistry } from '@buildr/test-utils/demo/components';
import { useMemo } from 'react';

const adapter = {};

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
