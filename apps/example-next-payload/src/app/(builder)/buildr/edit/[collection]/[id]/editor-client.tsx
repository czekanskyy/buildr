'use client';

import { EditorApp } from '@next-buildr/editor';
import type { EditorClientProps } from '@next-buildr/next/editor';
import { createPayloadAdapter } from '@next-buildr/payload/adapter';
import { useMemo } from 'react';
import { registry } from '../../../../../../buildr.registry.ts';

export function EditorClient(props: EditorClientProps) {
  const adapter = useMemo(() => createPayloadAdapter({ baseUrl: '/api' }), []);
  return (
    <div style={{ height: '100vh' }}>
      <EditorApp
        adapter={adapter}
        manifest={props.manifest}
        registry={registry.meta}
        canvasUrl={props.canvasUrl}
        documentRef={props.documentRef}
        {...(props.config === undefined ? {} : { config: props.config })}
      />
    </div>
  );
}
