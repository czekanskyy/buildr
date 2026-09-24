import type { ComponentMeta, RegistryManifest } from '@buildr/core';
import { createContext, type ReactNode, useContext } from 'react';

const ManifestContext = createContext<RegistryManifest | undefined>(undefined);

/** What the palette, the layers and the inspector know about the components (`toManifest`). */
export function ManifestProvider(props: {
  readonly manifest: RegistryManifest;
  readonly children: ReactNode;
}) {
  return (
    <ManifestContext.Provider value={props.manifest}>{props.children}</ManifestContext.Provider>
  );
}

/** The manifest, or `undefined` outside a `ManifestProvider` (the panels then fall back to the component's type). */
export function useManifest(): RegistryManifest | undefined {
  return useContext(ManifestContext);
}

/** One component's metadata, or `undefined` when the manifest does not have it. */
export function componentMeta(
  manifest: RegistryManifest | undefined,
  type: string,
): ComponentMeta | undefined {
  return manifest !== undefined && Object.hasOwn(manifest.components, type)
    ? manifest.components[type]
    : undefined;
}
