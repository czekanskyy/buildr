import { toManifest } from '@buildr/core';
import { EditorApp } from '@buildr/editor';
import '@buildr/editor/styles.css';
import { useMemo } from 'react';
import { createMemoryAdapter, PLAYGROUND_LOCALES } from './memory-adapter.ts';
import { registry } from './registry.ts';

const documentRef = { collection: 'pages', id: 'playground' };

/** `/`: the full editor, backed by `localStorage`. */
export function EditorPage() {
  const manifest = useMemo(() => toManifest(registry.meta), []);
  const adapter = useMemo(() => createMemoryAdapter(), []);
  return (
    <div style={{ height: '100vh' }}>
      <EditorApp
        adapter={adapter}
        manifest={manifest}
        registry={registry.meta}
        canvasUrl="/canvas"
        documentRef={documentRef}
        locales={PLAYGROUND_LOCALES as never}
      />
    </div>
  );
}
