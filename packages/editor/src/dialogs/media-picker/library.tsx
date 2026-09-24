import { createContext, type ReactNode, useContext, useMemo } from 'react';
import type { DocumentAdapter } from '../../persistence/index.ts';

/** The media the editor can offer: what the adapter's `media` gives, and where a picked entry lives. */
export interface MediaLibrary {
  readonly media: DocumentAdapter['media'];
  /** The collection a `MediaRef` names (`media` in the Payload plugin's defaults). */
  readonly collection: string;
}

const LibraryContext = createContext<MediaLibrary | undefined>(undefined);

export interface MediaLibraryProviderProps {
  readonly media: DocumentAdapter['media'];
  readonly collection?: string | undefined;
  readonly children: ReactNode;
}

export function MediaLibraryProvider({ media, collection, children }: MediaLibraryProviderProps) {
  const value = useMemo(() => ({ media, collection: collection ?? 'media' }), [media, collection]);
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

/** The media library, or `undefined` when the editor was given none (the media control then says so). */
export const useMediaLibrary = (): MediaLibrary | undefined => useContext(LibraryContext);
