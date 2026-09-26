// Universal: imported by the server, the canvas client and the Payload CLI. It imports no CSS.
import { createDefaultRegistry, defaultComponents } from '@next-buildr/components';
import { defaultTheme } from '@next-buildr/core';

/** The whole component library; add your own with `createRegistry({ components: [...defaultComponents, ...custom] })`. */
export const registry = createDefaultRegistry();
export const theme = defaultTheme;
export { defaultComponents };

/** The site's languages, the default first. Payload's `localization` is built from this. */
export const LOCALES = ['pl', 'en'] as const;
export const DEFAULT_LOCALE = 'pl';
export type Locale = (typeof LOCALES)[number];
