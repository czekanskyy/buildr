import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { en, type MessageKey, type Messages } from './en.ts';
import { pl } from './pl.ts';

export type { MessageKey, Messages } from './en.ts';

/** The languages the editor's own interface is translated to. */
export const UI_LOCALES = ['en', 'pl'] as const;
export type UiLocale = (typeof UI_LOCALES)[number];

const catalogs: Readonly<Record<UiLocale, Messages>> = { en, pl };

export type Translate = (key: MessageKey) => string;

/** The base of every message that has `.one`, `.few`, `.many` and `.other` forms. */
export type PluralKey = MessageKey extends infer K
  ? K extends `${infer B}.other`
    ? B
    : never
  : never;

/** `plural(key, count)`: the form of `key` for `count` (CLDR rules), with `{count}` filled in. */
export type TranslatePlural = (key: PluralKey, count: number) => string;

/** Fills `{name}` placeholders. Values are inserted literally; unknown placeholders stay. */
export function interpolate(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : whole,
  );
}

/** `t(key)` for a locale; a locale the editor has no catalog for falls back to English. */
export function createTranslator(locale: string): Translate {
  const base = locale.split('-', 1)[0] ?? 'en';
  const catalog = Object.hasOwn(catalogs, base) ? catalogs[base as UiLocale] : en;
  return (key) => catalog[key] ?? en[key];
}

/** Plural selection for a locale (`Intl.PluralRules`: Polish has one, few and many). */
// Counts must be integers: the Polish forms are integer genitive plurals, so fractional counts are not supported.
export function createPluralTranslator(locale: string): TranslatePlural {
  const t = createTranslator(locale);
  const base = locale.split('-', 1)[0] ?? 'en';
  const rules = new Intl.PluralRules(Object.hasOwn(catalogs, base) ? base : 'en');
  return (key, count) => {
    const form = `${key}.${rules.select(count)}` as MessageKey;
    const chosen = Object.hasOwn(en, form) ? form : (`${key}.other` as MessageKey);
    return interpolate(t(chosen), { count });
  };
}

const TranslateContext = createContext<Translate>(createTranslator('en'));
const PluralContext = createContext<TranslatePlural>(createPluralTranslator('en'));
const UiLocaleContext = createContext('en');

export function MessagesProvider(props: { readonly locale: string; readonly children: ReactNode }) {
  const t = useMemo(() => createTranslator(props.locale), [props.locale]);
  const plural = useMemo(() => createPluralTranslator(props.locale), [props.locale]);
  return (
    <TranslateContext.Provider value={t}>
      <PluralContext.Provider value={plural}>
        <UiLocaleContext.Provider value={props.locale}>{props.children}</UiLocaleContext.Provider>
      </PluralContext.Provider>
    </TranslateContext.Provider>
  );
}

/** The language code the editor's interface was asked to use (`config.uiLocale`). */
export function useUiLocale(): string {
  return useContext(UiLocaleContext);
}

/** The plural translator of the editor's interface language. */
export function usePlural(): TranslatePlural {
  return useContext(PluralContext);
}

/** The translator of the editor's interface language. */
export function useT(): Translate {
  return useContext(TranslateContext);
}
