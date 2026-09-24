'use client';

import { toManifest } from '@buildr/core';
import { createPayloadCanvasDataSource } from '@buildr/payload/adapter';
import type { Platform } from '@buildr/react';
import { CanvasRuntime } from '@buildr/react/canvas';
import { createElement, useEffect, useMemo, useState } from 'react';
import { registry, theme } from '../../../../buildr.registry.ts';

// Links must not navigate inside the editor's frame, so the canvas uses plain anchors and images.
const canvasPlatform: Platform = {
  Link: ({ href, children, ...rest }) => createElement('a', { href, ...rest }, children),
  Image: ({ src, alt, ...rest }) => createElement('img', { src, alt, ...rest }),
  formAction: (ref, nodeId) => `/api/buildr/forms/${ref.replace(':', '/')}/${nodeId}`,
};

const API = '/api';

/** The sample data of a document (`collection:id`): the editing user's view, drafts included. */
async function loadScopes(contextRef: string | null, locale: string) {
  if (contextRef === null) return {};
  const [collection, id] = contextRef.split(':');
  if (collection === undefined || id === undefined) return {};
  const query = new URLSearchParams({ collection, id, draft: '1', locale });
  const response = await fetch(`${API}/buildr/data/context?${query}`, {
    credentials: 'same-origin',
  });
  if (!response.ok) throw new Error(`Could not load the sample data (${response.status})`);
  return ((await response.json()) as { scopes: Record<string, never> }).scopes;
}

export function CanvasClient() {
  const dataSource = useMemo(() => createPayloadCanvasDataSource({ baseUrl: API }), []);
  // The canvas talks to its parent only; the origin is known in the browser, so nothing renders on the server.
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  const manifestHash = useMemo(() => toManifest(registry.meta).hash, []);
  if (origin === null) return null;
  return (
    <CanvasRuntime
      registry={registry}
      theme={theme}
      platform={canvasPlatform}
      dataSource={dataSource}
      allowedOrigins={[origin]}
      manifestHash={manifestHash}
      rendererVersion="0.1.0"
      loadScopes={loadScopes}
    />
  );
}
