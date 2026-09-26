import { toManifest } from '@next-buildr/core';
import { BuildrEditorPage, editorMetadata } from '@next-buildr/next/editor';
import { registry } from '../../../../../../buildr.registry.ts';
import { isSignedIn } from '../../../../../../lib/auth.ts';
import { EditorClient } from './editor-client.tsx';

export const metadata = editorMetadata;

const manifest = toManifest(registry.meta);

export default async function EditPage({
  params,
}: {
  params: Promise<{ collection: string; id: string }>;
}) {
  const { collection, id } = await params;
  return (
    <BuildrEditorPage
      collection={collection}
      id={id}
      authorize={() => isSignedIn()}
      loginUrl="/admin/login"
      returnTo={`/buildr/edit/${collection}/${id}`}
      manifest={manifest}
      render={(props) => <EditorClient {...props} />}
    />
  );
}
