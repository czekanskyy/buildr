export type { RegistryManifest } from './manifest.ts';
export { fromManifest, manifestHash, registryManifestSchema, toManifest } from './manifest.ts';
export type { ContentCategory, Matcher } from './matchers.ts';
export {
  CONTENT_CATEGORIES,
  categoryOf,
  isCategoryMatcher,
  isValidContentCategory,
  matchesType,
} from './matchers.ts';
export type {
  A11yMeta,
  ComponentCapabilities,
  ComponentCategory,
  ComponentMeta,
  EditorMeta,
  FormFieldMeta,
  ParentRules,
  SlotDef,
  StyleGroupId,
} from './meta.ts';
export type { RegistryMeta, RegistryMetaInput, TemplateDefinition } from './registry.ts';
export { createRegistryMeta } from './registry.ts';
export { validateComponentMeta } from './validate-meta.ts';
