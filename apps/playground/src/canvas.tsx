import { createGalleryDataSource, defaultTheme } from '@next-buildr/components';
import '@next-buildr/components/styles.css';
import { toManifest } from '@next-buildr/core';
import { CanvasRuntime } from '@next-buildr/react/canvas';
import { demoPlatform } from '@next-buildr/test-utils/demo/components';
import { useMemo } from 'react';
import { authorCodeFromSearch } from './editor-route.ts';
import { sampleScopes } from './memory-adapter.ts';
import { registry } from './registry.ts';

/** `/canvas`: the page the editor puts in its iframe. */
export function CanvasPage() {
  const dataSource = useMemo(createGalleryDataSource, []);
  const authorCode = useMemo(() => authorCodeFromSearch(window.location.search), []);
  const manifestHash = useMemo(() => toManifest(registry.meta).hash, []);
  return (
    <CanvasRuntime
      registry={registry}
      theme={defaultTheme}
      platform={demoPlatform}
      dataSource={dataSource}
      capabilities={{ authorCode }}
      allowedOrigins={[window.location.origin]}
      manifestHash={manifestHash}
      rendererVersion="0.0.0"
      loadScopes={async (contextRef, locale) => sampleScopes(contextRef, locale)}
    />
  );
}
