import type { LocaleConfig } from '@next-buildr/core';
import type { PayloadRequest, SanitizedConfig } from 'payload';
import { fail } from './endpoints/respond.ts';

/** The locale of an installation without Payload localization: one language, no fallback. */
const SINGLE_LOCALE: LocaleConfig = {
  locales: ['en'],
  default: 'en',
  fallback: false,
  intl: { en: 'English' },
};

/**
 * The languages of the site as Payload's `localization` configures them, or `undefined` when it is
 * not configured (docs/i18n.md#payload). `intl` carries the display names for the language switcher.
 */
export function configuredLocales(config: SanitizedConfig): LocaleConfig | undefined {
  const localization = config.localization;
  if (localization === false || localization === undefined) return undefined;
  const intl: Record<string, string> = {};
  for (const locale of localization.locales) {
    const label = locale.label;
    intl[locale.code] =
      typeof label === 'string'
        ? label
        : ((label as Record<string, string> | undefined)?.[localization.defaultLocale] ??
          locale.code);
  }
  return {
    locales: localization.localeCodes,
    default: localization.defaultLocale,
    fallback: localization.fallback !== false,
    intl,
  };
}

/** `configuredLocales`, or the single-locale configuration when localization is off. */
export const localeConfigOf = (config: SanitizedConfig): LocaleConfig =>
  configuredLocales(config) ?? SINGLE_LOCALE;

/** The options of a Local API read in a language (`locale`, `fallbackLocale`); empty when localization is off. */
export interface LocaleArgs {
  readonly locale?: string;
  readonly fallbackLocale?: false;
}

export type LocaleChoice =
  | {
      readonly ok: true;
      /** The language asked for, or the default one; `undefined` without localization. */
      readonly locale: string | undefined;
      /** Spread into a Local API call. */
      readonly args: LocaleArgs;
    }
  | { readonly ok: false; readonly response: Response };

/**
 * The language of a request (`requested`: the `locale` parameter or body field). Without Payload
 * localization it is ignored, so an installation that has none behaves as it did. With it, no
 * value means the default language and one that is not configured is a `400`; when the
 * configuration turns `fallback` off, reads do not fall back to the default language either.
 */
export function chooseLocale(
  req: Pick<PayloadRequest, 'payload'>,
  requested: string | null | undefined,
): LocaleChoice {
  const configured = configuredLocales(req.payload.config);
  if (configured === undefined) return { ok: true, locale: undefined, args: {} };
  const locale =
    requested === undefined || requested === null || requested === ''
      ? configured.default
      : requested;
  if (!configured.locales.includes(locale)) {
    return { ok: false, response: fail(400, `The locale "${locale}" is not configured.`) };
  }
  return {
    ok: true,
    locale,
    args: { locale, ...(configured.fallback ? {} : { fallbackLocale: false as const }) },
  };
}
