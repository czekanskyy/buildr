import { createContext, type ReactNode, useContext } from 'react';

const PortalContainerContext = createContext<HTMLElement | null>(null);

export interface PortalContainerProviderProps {
  /** The editor root; floating layers render inside it, so they inherit its theme (`data-theme`). */
  readonly container: HTMLElement | null;
  readonly children: ReactNode;
}

/**
 * Where Radix renders menus, popovers, dialogs and tooltips. Without a provider they go to
 * `document.body`, outside `.buildr-editor`, and miss the theme the root carries.
 */
export function PortalContainerProvider({ container, children }: PortalContainerProviderProps) {
  return (
    <PortalContainerContext.Provider value={container}>{children}</PortalContainerContext.Provider>
  );
}

/** The element floating layers render into; `undefined` (Radix's default, `document.body`) without a provider. */
export function usePortalContainer(): HTMLElement | undefined {
  return useContext(PortalContainerContext) ?? undefined;
}
