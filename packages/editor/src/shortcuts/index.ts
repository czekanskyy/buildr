export type { ExternalActions } from './actions.ts';
export { bindEditorActions } from './actions.ts';
export type { KeyInput, Platform } from './keys.ts';
export { comboOf, detectPlatform, displayCombo, isTypingTarget, normalizeCombo } from './keys.ts';
export type { ShortcutDef } from './map.ts';
export { applyOverrides, DEFAULT_SHORTCUTS } from './map.ts';
export type { ShortcutHandler, ShortcutRegistry, ShortcutRegistryOptions } from './registry.ts';
export { createShortcutRegistry } from './registry.ts';
export type { ShortcutProviderProps } from './shortcuts.tsx';
export {
  ShortcutProvider,
  useForwardedKeys,
  useOptionalShortcutRegistry,
  useShortcutHint,
  useShortcutRegistry,
} from './shortcuts.tsx';
