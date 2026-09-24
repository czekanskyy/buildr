export type { BuildrConfig, BuildrConfigInput, BuildrEntry } from './config.ts';
export { createBuildrConfig } from './config.ts';
export type { LocaleSet, LocaleStaticParamsInput } from './i18n.ts';
export {
  createLocaleMiddleware,
  generateLocaleStaticParams,
  isLocale,
  negotiateLocale,
} from './i18n.ts';
export type {
  BuildrMetadata,
  BuildrMetadataDefaults,
  BuildrMetadataEntry,
  BuildrSeo,
} from './metadata.ts';
export { buildrMetadata } from './metadata.ts';
export type { BuildrPageProps } from './page.tsx';
export { BuildrPage } from './page.tsx';
export type { NextPlatformOptions } from './platform.tsx';
export { createNextPlatform, isInternalHref } from './platform.tsx';
export type { BuildrSectionBoundaryProps } from './section-boundary.tsx';
export { BuildrSectionBoundary } from './section-boundary.tsx';
