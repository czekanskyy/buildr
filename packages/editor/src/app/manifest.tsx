import type { ComponentMeta, RegistryManifest } from '@next-buildr/core';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { localizeManifest } from '../i18n/localize-manifest.ts';
import { useUiLocale } from '../messages/index.tsx';

const ManifestContext = createContext<RegistryManifest | undefined>(undefined);
const SourceManifestContext = createContext<RegistryManifest | undefined>(undefined);

/**
 * What the palette, the layers and the inspector know about the components (`toManifest`). The
 * panels read it with its labels in the interface language (`i18n/localize-manifest.ts`).
 */
export function ManifestProvider(props: {
  readonly manifest: RegistryManifest;
  readonly children: ReactNode;
}) {
  const locale = useUiLocale();
  const localized = useMemo(
    () => localizeManifest(props.manifest, locale),
    [props.manifest, locale],
  );
  return (
    <SourceManifestContext.Provider value={props.manifest}>
      <ManifestContext.Provider value={localized}>{props.children}</ManifestContext.Provider>
    </SourceManifestContext.Provider>
  );
}

/** The manifest, or `undefined` outside a `ManifestProvider` (the panels then fall back to the component's type). Its labels are in the interface language. */
export function useManifest(): RegistryManifest | undefined {
  return useContext(ManifestContext);
}

/** The manifest as the application registered it, in its own (English) words: what the checks' messages quote. */
export function useSourceManifest(): RegistryManifest | undefined {
  return useContext(SourceManifestContext);
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
