import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useT } from '../messages/index.tsx';
import { useEditor } from '../store/index.ts';
import { Dialog } from '../ui/index.ts';
import { bindEditorActions, type ExternalActions } from './actions.ts';
import {
  detectPlatform,
  displayCombo,
  isTypingTarget,
  type KeyInput,
  type Platform,
} from './keys.ts';
import { createShortcutRegistry, type ShortcutRegistry } from './registry.ts';

const RegistryContext = createContext<ShortcutRegistry | undefined>(undefined);

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
  children,
}: ShortcutProviderProps) {
  const store = useEditor();
  const t = useT();
  const [helpOpen, setHelpOpen] = useState(false);
  const detected = useMemo(() => platform ?? detectPlatform(), [platform]);
  const registry = useMemo(
    () => createShortcutRegistry({ platform: detected, overrides: overrides ?? {} }),
    [detected, overrides],
  );
  // The handlers read the latest actions without rebinding on every render.
  const external = useRef<ExternalActions>({});
  external.current = actions ?? {};

  useEffect(() => {
    const unbind = bindEditorActions(registry, store, {
      copy: () => external.current.copy?.() ?? false,
      cut: () => external.current.cut?.() ?? false,
      paste: () => external.current.paste?.() ?? false,
      save: () => external.current.save?.() ?? false,
    });
    const unbindHelp = registry.bind('help.shortcuts', () => {
      setHelpOpen(true);
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
      const handled = registry.handle(toInput(event), { typing: isTypingTarget(event.target) });
      if (handled) event.preventDefault();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [registry]);

  const groups = (['edit', 'selection', 'file', 'help'] as const).map((group) => ({
    group,
    items: registry.shortcuts.filter(
      (shortcut) => shortcut.group === group && shortcut.keys.length > 0,
    ),
  }));

  return (
    <RegistryContext.Provider value={registry}>
      {children}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen} title={t('shortcut.title')}>
        <div className="bd-shortcut-help">
          {groups
            .filter(({ items }) => items.length > 0)
            .map(({ group, items }) => (
              <section key={group}>
                <h4>{t(`shortcut.group.${group}`)}</h4>
                <dl>
                  {items.map((shortcut) => (
                    <div key={shortcut.action} className="bd-shortcut-row">
                      <dt>{t(shortcut.label)}</dt>
                      <dd>
                        {shortcut.keys.map((combo, index) => (
                          <span key={combo}>
                            {index > 0 ? ' / ' : ''}
                            <kbd>{displayCombo(combo, detected)}</kbd>
                          </span>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
        </div>
      </Dialog>
    </RegistryContext.Provider>
  );
}
