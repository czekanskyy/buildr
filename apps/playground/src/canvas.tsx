import { createGalleryDataSource, defaultTheme } from '@buildr/components';
import '@buildr/components/styles.css';
import { toManifest } from '@buildr/core';
import { CanvasRuntime } from '@buildr/react/canvas';
import { demoPlatform } from '@buildr/test-utils/demo/components';
import { useMemo } from 'react';
import { sampleScopes } from './memory-adapter.ts';
import { registry } from './registry.ts';

/** `/canvas`: the page the editor puts in its iframe. */
export function CanvasPage() {
  const dataSource = useMemo(createGalleryDataSource, []);
  const manifestHash = useMemo(() => toManifest(registry.meta).hash, []);
  return (
    <CanvasRuntime
      registry={registry}
      theme={defaultTheme}
      platform={demoPlatform}
      dataSource={dataSource}
      allowedOrigins={[window.location.origin]}
      manifestHash={manifestHash}
      rendererVersion="0.0.0"
      loadScopes={async (contextRef, locale) => sampleScopes(contextRef, locale)}
    />
  );
}
