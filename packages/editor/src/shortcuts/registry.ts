import { comboOf, type KeyInput, type Platform } from './keys.ts';
import { applyOverrides, DEFAULT_SHORTCUTS, type ShortcutDef } from './map.ts';

/** A handler returns `false` when it did nothing, so the key keeps its default behaviour. */
export type ShortcutHandler = () => boolean | undefined;

export interface ShortcutRegistryOptions {
  readonly platform: Platform;
  readonly shortcuts?: readonly ShortcutDef[];
  readonly overrides?: Readonly<Record<string, string>>;
}

export interface ShortcutRegistry {
  readonly platform: Platform;
  readonly shortcuts: readonly ShortcutDef[];
  /**
   * Attaches `handler` to an action in `scope` (`'editor'` unless said otherwise). Returns the
   * function that removes it.
   */
  bind(action: string, handler: ShortcutHandler, scope?: string): () => void;
  /** The scopes whose bindings fire; `['editor']` at first. A modal dialog narrows it to its own. */
  setScopes(scopes: readonly string[]): void;
  /**
   * Runs the handler of the shortcut `input` is, and says whether one ran. Nothing runs while
   * `typing` (the focus is in a text field): there the keys belong to the text.
   */
  handle(input: KeyInput, options: { readonly typing: boolean }): boolean;
  /** The combinations of an action, canonical (`mod+z`). */
  keysFor(action: string): readonly string[];
}

/** A shortcut registry of its own — nothing here is shared between editors (no global state). */
export function createShortcutRegistry(options: ShortcutRegistryOptions): ShortcutRegistry {
  const shortcuts = applyOverrides(options.shortcuts ?? DEFAULT_SHORTCUTS, options.overrides ?? {});
  const actionOf = new Map<string, string>();
  for (const shortcut of shortcuts) {
    // A combination belongs to the first action that claims it.
    for (const combo of shortcut.keys)
      if (!actionOf.has(combo)) actionOf.set(combo, shortcut.action);
  }
  const bindings = new Map<string, { handler: ShortcutHandler; scope: string }[]>();
  let scopes: readonly string[] = ['editor'];

  return {
    platform: options.platform,
    shortcuts,
    bind(action, handler, scope = 'editor') {
      const entry = { handler, scope };
      const list = bindings.get(action) ?? [];
      list.push(entry);
      bindings.set(action, list);
      return () => {
        const current = bindings.get(action) ?? [];
        const at = current.indexOf(entry);
        if (at !== -1) current.splice(at, 1);
      };
    },
    setScopes(next) {
      scopes = [...next];
    },
    handle(input, { typing }) {
      if (typing) return false;
      const action = actionOf.get(comboOf(input, options.platform));
      if (action === undefined) return false;
      // The most recent binding in an active scope wins, as a dialog's handler should over the editor's.
      const list = bindings.get(action) ?? [];
      for (let at = list.length - 1; at >= 0; at--) {
        const entry = list[at];
        if (entry === undefined || !scopes.includes(entry.scope)) continue;
        return entry.handler() !== false;
      }
      return false;
    },
    keysFor(action) {
      return shortcuts.find((shortcut) => shortcut.action === action)?.keys ?? [];
    },
  };
}
