'use client';
import { lazy, Suspense } from 'react';

// Payload UI pulls in stylesheets, which a plain Node import (the Payload CLI, the entry-point
// smoke test) cannot load; the bundler splits it out and only the admin ever renders it.
const Connected = lazy(async () => {
  const mod = await import('./layout-field-connected.tsx');
  return { default: mod.ConnectedLayoutField };
});

/** The `layout` field of a collection with the plugin installed (referenced from the import map). */
export function LayoutField(props: { readonly path: string; readonly editorRoute?: string }) {
  return (
    <Suspense fallback={null}>
      <Connected {...props} />
    </Suspense>
  );
}
