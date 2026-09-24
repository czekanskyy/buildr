'use client';
import { useDocumentInfo, useField } from '@payloadcms/ui';
import { LayoutFieldView } from './layout-field-view.tsx';

const countNodes = (value: unknown): number | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;
  const nodes = (value as { nodes?: unknown }).nodes;
  return typeof nodes === 'object' && nodes !== null ? Object.keys(nodes).length : undefined;
};

/** The `layout` field of a collection with the plugin installed (referenced from the import map). */
export function LayoutField(props: { readonly path: string; readonly editorRoute?: string }) {
  const { value } = useField<unknown>({ path: props.path });
  const info = useDocumentInfo();
  return (
    <LayoutFieldView
      nodeCount={countNodes(value)}
      id={info.id}
      collection={info.collectionSlug ?? ''}
      editorRoute={props.editorRoute ?? '/buildr/edit'}
    />
  );
}
