import { toManifest } from '@next-buildr/core';
import { EditorApp } from '@next-buildr/editor';
import '@next-buildr/editor/styles.css';
import { useMemo } from 'react';
import { parseEditorRoute } from './editor-route.ts';
import { createMemoryAdapter } from './memory-adapter.ts';
import { registry } from './registry.ts';
import { seeds } from './visual-seeds.ts';

const documentRef = { collection: 'pages', id: 'playground' };

/** `/`: the full editor, backed by `localStorage`. */
export function EditorPage() {
  const manifest = useMemo(() => toManifest(registry.meta), []);
  const route = useMemo(() => parseEditorRoute(window.location.search), []);
  // A seeded page (the visual suite, PB-118) never reads or writes `localStorage`, so it is the same on every run.
  const adapter = useMemo(
    () =>
      route.seed === undefined
        ? createMemoryAdapter()
        : createMemoryAdapter({
            storage: { getItem: () => null, setItem: () => undefined },
            initial: seeds[route.seed],
          }),
    [route.seed],
  );
  return (
    <div style={{ height: '100dvh' }}>
      <EditorApp
        adapter={adapter}
        manifest={manifest}
        registry={registry.meta}
        canvasUrl="/canvas"
        documentRef={documentRef}
        {...(route.theme === undefined ? {} : { config: { theme: route.theme } })}
      />
    </div>
  );
}
