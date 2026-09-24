import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { en, type MessageKey, type Messages } from './en.ts';
import { pl } from './pl.ts';

export type { MessageKey, Messages } from './en.ts';

/** The languages the editor's own interface is translated to. */
export const UI_LOCALES = ['en', 'pl'] as const;
export type UiLocale = (typeof UI_LOCALES)[number];

const catalogs: Readonly<Record<UiLocale, Messages>> = { en, pl };

export type Translate = (key: MessageKey) => string;

/** `t(key)` for a locale; a locale the editor has no catalog for falls back to English. */
export function createTranslator(locale: string): Translate {
  const base = locale.split('-', 1)[0] ?? 'en';
  const catalog = Object.hasOwn(catalogs, base) ? catalogs[base as UiLocale] : en;
  return (key) => catalog[key] ?? en[key];
}

const TranslateContext = createContext<Translate>(createTranslator('en'));

export function MessagesProvider(props: { readonly locale: string; readonly children: ReactNode }) {
  const t = useMemo(() => createTranslator(props.locale), [props.locale]);
  return <TranslateContext.Provider value={t}>{props.children}</TranslateContext.Provider>;
}

/** The translator of the editor's interface language. */
export function useT(): Translate {
  return useContext(TranslateContext);
}
