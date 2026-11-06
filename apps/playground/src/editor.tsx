import { toManifest } from '@next-buildr/core';
import { EditorApp } from '@next-buildr/editor';
import '@next-buildr/editor/styles.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { authorCodeFromSearch, parseEditorRoute } from './editor-route.ts';
import { createMemoryAdapter, DEMO_MEDIA } from './memory-adapter.ts';
import { registry } from './registry.ts';
import { seeds } from './visual-seeds.ts';

const documentRef = { collection: 'pages', id: 'playground' };

/** A demo with a memory adapter has no permissions: whoever is editing may unlock. */
const allowUnlock = () => true;

/** `/`: the full editor, backed by `localStorage`. */
export function EditorPage() {
  const manifest = useMemo(() => toManifest(registry.meta), []);
  const route = useMemo(() => parseEditorRoute(window.location.search), []);
  // Author code (ADR-026) is on in the playground; `?authorCode=0` turns it off, for the canvas too.
  const authorCode = useMemo(() => authorCodeFromSearch(window.location.search), []);
  // A seeded page (the visual suite, PB-118) never reads or writes `localStorage`, so it is the same on every run.
  const adapter = useMemo(
    () =>
      route.seed === undefined
        ? createMemoryAdapter({ media: DEMO_MEDIA })
        : createMemoryAdapter({
            storage: { getItem: () => null, setItem: () => undefined },
            initial: seeds[route.seed],
          }),
    [route.seed],
  );
  // The demo has no version store: the history icon (an editor prop) only says so. Seeded pages
  // (the visual suite) leave it out, so their screenshots do not change.
  const [note, setNote] = useState('');
  const showHistory = useCallback(() => {
    setNote('Historia wersji: wersja demonstracyjna nie przechowuje wersji strony.');
  }, []);
  useEffect(() => {
    if (note === '') return;
    const timer = window.setTimeout(() => setNote(''), 4000);
    return () => window.clearTimeout(timer);
  }, [note]);
  return (
    <div style={{ height: '100dvh' }}>
      <EditorApp
        adapter={adapter}
        manifest={manifest}
        registry={registry.meta}
        migrations={registry.migrations}
        canUnlock={allowUnlock}
        capabilities={{ authorCode }}
        canvasUrl={authorCode ? '/canvas' : '/canvas?authorCode=0'}
        documentRef={documentRef}
        {...(route.seed === undefined ? { historyUrl: showHistory } : {})}
        config={{
          ...(route.theme === undefined ? {} : { theme: route.theme }),
          uiLocale: route.uiLocale ?? 'pl',
        }}
      />
      {note === '' ? null : (
        <div
          role="status"
          data-testid="history-note"
          style={{
            position: 'fixed',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 14px',
            borderRadius: 8,
            background: '#1f2937',
            color: '#fff',
            font: '14px system-ui, sans-serif',
            zIndex: 1000,
          }}
        >
          {note}
        </div>
      )}
    </div>
  );
}
