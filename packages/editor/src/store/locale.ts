import type { LocaleConfig } from '@next-buildr/core';
import { createContext, createElement, type ReactNode, useContext } from 'react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';

/** The language of the content being edited (docs/i18n.md#model-shared-structure-localized-content). */
export interface LocaleState {
  readonly config: LocaleConfig;
  /** The language edits go to; always one of `config.locales`. */
  readonly locale: string;
  /** Changes the language. An unknown code is ignored. */
  setLocale(locale: string): void;
}

export type LocaleStore = StoreApi<LocaleState>;

/** The state for a language configuration, starting on `initial` (the default language unless it is unknown). */
export function createLocaleStore(config: LocaleConfig, initial?: string): LocaleStore {
  return createStore<LocaleState>((set, get) => ({
    config,
    locale: initial !== undefined && config.locales.includes(initial) ? initial : config.default,
    setLocale(locale) {
      if (locale === get().locale || !config.locales.includes(locale)) return;
      set({ locale });
    },
  }));
}

const LocaleContext = createContext<LocaleStore | undefined>(undefined);

export function LocaleProvider(props: {
  readonly store: LocaleStore;
  readonly children: ReactNode;
}) {
  return createElement(LocaleContext.Provider, { value: props.store }, props.children);
}

/** The locale store, or `undefined` outside a `LocaleProvider` (the panels then edit the default language). */
export const useOptionalLocaleStore = (): LocaleStore | undefined => useContext(LocaleContext);

const FALLBACK: LocaleState = {
  config: { locales: ['en'], default: 'en', fallback: true, intl: { en: 'English' } },
  locale: 'en',
  setLocale: () => undefined,
};
const FALLBACK_STORE = createStore<LocaleState>(() => FALLBACK);

/** The current language state; the single-language default outside a provider. */
export function useLocaleState<T>(select: (state: LocaleState) => T): T {
  return useStore(useOptionalLocaleStore() ?? FALLBACK_STORE, select);
}
