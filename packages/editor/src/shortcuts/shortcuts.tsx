import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { RemoveRequest, ShortcutCallbacks } from '../app/contracts.ts';
import { useEditor } from '../store/index.ts';
import { bindEditorActions, type ExternalActions } from './actions.ts';
import { ShortcutsDialog } from './help.tsx';
import {
  detectPlatform,
  displayCombo,
  isTypingTarget,
  type KeyInput,
  type Platform,
} from './keys.ts';
import { overlayOpen } from './navigation.ts';
import { createShortcutRegistry, type ShortcutRegistry } from './registry.ts';

const RegistryContext = createContext<ShortcutRegistry | undefined>(undefined);
const OpenShortcutsContext = createContext<(() => void) | undefined>(undefined);

/**
 * Opens the shortcuts dialog directly (the host's `openShortcuts` callback, else the built-in
 * dialog), without going through a key combination another action may have taken. `undefined`
 * outside a `<ShortcutProvider>`.
 */
export function useOpenShortcuts(): (() => void) | undefined {
  return useContext(OpenShortcutsContext);
}

const EDITOR_ROOT = '.buildr-editor';
const OWN_KEYS = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

const inOverlay = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest(OWN_KEYS) !== null;

/** Whether a key press is aimed at a control of the host page outside the editor (body and the document are not). */
function outsideEditor(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target === document.body || target === document.documentElement) return false;
  return target.closest(EDITOR_ROOT) === null;
}

/** The registry of the enclosing `<ShortcutProvider>`, or `undefined` outside one (a toolbar shown without shortcuts). */
export function useOptionalShortcutRegistry(): ShortcutRegistry | undefined {
  return useContext(RegistryContext);
}

/** The registry of the enclosing `<ShortcutProvider>`, for modules that bind actions of their own. */
export function useShortcutRegistry(): ShortcutRegistry {
  const registry = useContext(RegistryContext);
  if (registry === undefined) {
    throw new Error('useShortcutRegistry must be used inside <ShortcutProvider>');
  }
  return registry;
}

/**
 * What the canvas host's `onKeyDown` should call with a forwarded `key:down`. The canvas already
 * keeps text fields and inline edits to itself, so a forwarded key is never "typing". Returns
 * whether a shortcut took it.
 */
export function useForwardedKeys(): (input: KeyInput) => boolean {
  const registry = useShortcutRegistry();
  return (input) => registry.handle(input, { typing: false });
}

export interface ShortcutProviderProps {
  /** Overrides by action id (`config.shortcuts`). */
  readonly overrides?: Readonly<Record<string, string>>;
  /** The actions other modules provide: clipboard (PB-085) and save (PB-087). */
  readonly actions?: ExternalActions;
  readonly platform?: Platform;
  /** The shortcuts that change only the UI (device, panels, outlines, search, help); missing ones do nothing. */
  readonly callbacks?: Partial<ShortcutCallbacks>;
  /** Called instead of removing on Delete/Backspace, so the host can confirm or offer Undo. */
  readonly onRemove?: (request: RemoveRequest) => void;
  readonly children: ReactNode;
}

const toInput = (event: KeyboardEvent): KeyInput => ({
  key: event.key,
  mods: { shift: event.shiftKey, alt: event.altKey, ctrl: event.ctrlKey, meta: event.metaKey },
});

/**
 * Keyboard shortcuts for the editor (docs/editor.md#keyboard-shortcuts-pb-084): a registry, the
 * store's actions bound to it, a `keydown` listener on the document, and the help dialog (`?`).
 * A key press whose focus is in a text field is never handled, and a handled one gets
 * `preventDefault`, so the browser does not also act on it.
 */
export function ShortcutProvider({
  overrides,
  actions,
  platform,
  callbacks,
  onRemove,
  children,
}: ShortcutProviderProps) {
  const store = useEditor();
  const [helpOpen, setHelpOpen] = useState(false);
  const detected = useMemo(() => platform ?? detectPlatform(), [platform]);
  const registry = useMemo(
    () => createShortcutRegistry({ platform: detected, overrides: overrides ?? {} }),
    [detected, overrides],
  );
  // The handlers read the latest actions without rebinding on every render.
  const external = useRef<ExternalActions>({});
  external.current = actions ?? {};
  const host = useRef({ callbacks, onRemove });
  host.current = { callbacks, onRemove };
  // Set while a key press aimed outside the editor is handled: the UI-only keys then stay out of it.
  const outside = useRef(false);

  useEffect(() => {
    const unbind = bindEditorActions(
      registry,
      store,
      {
        copy: () => external.current.copy?.() ?? false,
        cut: () => external.current.cut?.() ?? false,
        paste: () => external.current.paste?.() ?? false,
        save: () => external.current.save?.() ?? false,
      },
      {
        callbacks: () => host.current.callbacks,
        onRemove: () => host.current.onRemove,
        uiAllowed: () => !outside.current,
      },
    );
    const unbindHelp = registry.bind('help.shortcuts', () => {
      if (overlayOpen()) return false;
      const open = host.current.callbacks?.openShortcuts;
      if (open === undefined) setHelpOpen(true);
      else open();
      return true;
    });
    return () => {
      unbind();
      unbindHelp();
    };
  }, [registry, store]);

  useEffect(() => {
    registry.setScopes(helpOpen ? ['dialog'] : ['editor']);
  }, [registry, helpOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      // A dialog, menu or list keeps its own keys (Delete, Ctrl+Z); Escape is its own to handle.
      if (inOverlay(event.target)) return;
      outside.current = outsideEditor(event.target);
      let handled: boolean;
      try {
        handled = registry.handle(toInput(event), { typing: isTypingTarget(event.target) });
      } finally {
        outside.current = false;
      }
      if (handled) event.preventDefault();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [registry]);

  const openShortcuts = useCallback(() => {
    const open = host.current.callbacks?.openShortcuts;
    if (open === undefined) setHelpOpen(true);
    else open();
  }, []);

  return (
    <RegistryContext.Provider value={registry}>
      <OpenShortcutsContext.Provider value={openShortcuts}>
        {children}
        <ShortcutsDialog
          open={helpOpen}
          onOpenChange={setHelpOpen}
          registry={registry}
          platform={detected}
        />
      </OpenShortcutsContext.Provider>
    </RegistryContext.Provider>
  );
}

/** How the first key of `action` is written on this platform (`Ctrl+Z`), for tooltips; `undefined` when it has none. */
export function useShortcutHint(action: string): string | undefined {
  const registry = useOptionalShortcutRegistry();
  const combo = registry?.keysFor(action)[0];
  return registry === undefined || combo === undefined
    ? undefined
    : displayCombo(combo, registry.platform);
}
