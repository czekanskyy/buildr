import type { RegistryManifest } from '@next-buildr/core';
import type { DocumentRef, EditorConfig } from '@next-buildr/editor';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { safeRedirectPath } from '../draft/route.ts';

/** What the application's client file receives: plain data, so it can cross the server-to-client boundary. */
export interface EditorClientProps {
  readonly manifest: RegistryManifest;
  readonly canvasUrl: string;
  readonly documentRef: DocumentRef;
  readonly config?: EditorConfig;
}

export interface BuildrEditorPageProps {
  readonly collection: string;
  readonly id: string | number;
  /**
   * Whether the caller is signed in with the right to edit. `false` means "not signed in" and
   * redirects to `loginUrl`; a `'forbidden'` answer (signed in, but not allowed) is a 404.
   */
  readonly authorize: () => boolean | 'forbidden' | Promise<boolean | 'forbidden'>;
  /** Where to sign in, e.g. `/admin/login`. The way back is added as `?redirect=`. */
  readonly loginUrl: string;
  /** The editor's own path, to come back to after signing in. */
  readonly returnTo: string;
  /** `toManifest(registry.meta)`, computed on the server. */
  readonly manifest: RegistryManifest;
  /** The canvas route the editor's iframe loads. Default `/buildr/canvas`. */
  readonly canvasUrl?: string;
  readonly config?: EditorConfig;
  /**
   * Renders the application's client file (`'use client'`), which builds the `DocumentAdapter` and
   * mounts `BuilderEditor`. Only that file imports `@next-buildr/editor`, so its bundle loads on this route only.
   */
  readonly render: (props: EditorClientProps) => ReactNode;
}

/** The `metadata` of the editor page: never indexed. */
export const editorMetadata = { robots: { index: false, follow: false } } as const;

/**
 * The server wrapper of `/buildr/edit/[collection]/[id]` (ADR-019): dynamic rendering, a login
 * redirect for a visitor who is not signed in, the manifest computed on the server, and
 * serializable props for the client file. It has its own root layout in the application, so no
 * site chrome surrounds the editor.
 */
export async function BuildrEditorPage(props: BuildrEditorPageProps) {
  await headers();
  const allowed = await props.authorize();
  if (allowed === 'forbidden') notFound();
  if (allowed === false) {
    const back = encodeURIComponent(safeRedirectPath(props.returnTo));
    const separator = props.loginUrl.includes('?') ? '&' : '?';
    redirect(`${safeRedirectPath(props.loginUrl)}${separator}redirect=${back}`);
  }
  return props.render({
    manifest: props.manifest,
    canvasUrl: props.canvasUrl ?? '/buildr/canvas',
    documentRef: { collection: props.collection, id: props.id },
    ...(props.config === undefined ? {} : { config: props.config }),
  });
}
