import { createContext, type ReactNode, useContext, useState } from 'react';
import { createSectionRegistry, type SectionRegistry } from './section-state.ts';

const SectionsContext = createContext<SectionRegistry | undefined>(undefined);

/**
 * Scopes the registry of mounted style sections to one editor. Wrap it around both the Inspector's
 * `headerActions` (where `SectionsToggle` sits) and the `StyleInspector`, so they share a registry
 * and two editors on a page never see each other's sections.
 */
export function StyleSectionsProvider(props: { readonly children: ReactNode }) {
  const [registry] = useState(createSectionRegistry);
  return <SectionsContext.Provider value={registry}>{props.children}</SectionsContext.Provider>;
}

/** Without a provider, a section or toggle gets a private registry (a lone toggle stays disabled). */
export function useSectionRegistry(): SectionRegistry {
  const provided = useContext(SectionsContext);
  const [own] = useState(createSectionRegistry);
  return provided ?? own;
}
