import type { ComponentMigrations } from '@next-buildr/core';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { type MessageKey, useT } from '../messages/index.tsx';
import type { ExternalActions } from '../shortcuts/index.ts';
import { useEditor } from '../store/index.ts';
import { TOAST_MS, usePortalContainer, useStructureLockedNotice, useToast } from '../ui/index.ts';
import {
  browserClipboard,
  type Clipboard,
  type ClipboardIO,
  type ClipboardResult,
  createClipboard,
} from './clipboard.ts';
import type { ClipboardError } from './format.ts';

const ClipboardContext = createContext<Clipboard | undefined>(undefined);

/** How long a refusal stays on screen. */
export const NOTICE_MS = TOAST_MS;

const MESSAGES: Readonly<Record<ClipboardError['code'], MessageKey>> = {
  empty: 'clipboard.error.empty',
  readOnly: 'clipboard.error.readOnly',
  notFragment: 'clipboard.error.notFragment',
  tooLarge: 'clipboard.error.tooLarge',
  unsupported: 'clipboard.error.unsupported',
  invalid: 'clipboard.error.invalid',
  rejected: 'clipboard.error.rejected',
  outdated: 'clipboard.outdated',
  locked: 'toast.structureLocked',
};

export function useClipboard(): Clipboard {
  const clipboard = useContext(ClipboardContext);
  if (clipboard === undefined)
    throw new Error('useClipboard must be used inside <ClipboardProvider>');
  return clipboard;
}

/** The clipboard's actions in the shape `<ShortcutProvider actions>` takes: each starts the work and claims the key. */
export function useClipboardActions(): Pick<ExternalActions, 'copy' | 'cut' | 'paste'> {
  const clipboard = useClipboard();
  const report = useContext(ReportContext);
  return useMemo(() => {
    const run = (action: () => Promise<ClipboardResult>) => () => {
      void action().then(report);
      return true;
    };
    return {
      copy: run(clipboard.copy),
      cut: run(clipboard.cut),
      paste: run(clipboard.paste),
    };
  }, [clipboard, report]);
}

const ReportContext = createContext<(result: ClipboardResult) => void>(() => undefined);

/**
 * Gives the editor's clipboard to the tree below and shows why a copy, cut or paste was refused in
 * the toast region (there is no dialog: a refused paste is not an emergency). `io` is the system
 * clipboard; by default `navigator.clipboard`, with the last copy kept in memory as a fallback.
 */
export function ClipboardProvider(props: {
  readonly io?: ClipboardIO | undefined;
  readonly migrations?: ComponentMigrations | undefined;
  readonly children: ReactNode;
}) {
  const store = useEditor();
  const t = useT();
  const notifyLocked = useStructureLockedNotice();
  const toast = useToast();
  const portalContainer = usePortalContainer();
  const io = props.io ?? browserClipboard();
  const clipboard = useMemo(() => {
    const base = createClipboard({ store, io, migrations: props.migrations });
    const withUndo = (action: () => Promise<ClipboardResult>, message: MessageKey) => async () => {
      const previousFocus = document.activeElement;
      const before = store.getState().docVersion;
      const result = await action();
      const version = store.getState().docVersion;
      if (result.ok && version !== before) {
        toast.show({
          id: 'clipboard.undo',
          variant: 'success',
          message: t(message),
          action: {
            label: t('shortcut.undo'),
            onSelect: () => {
              // Never undo a later, unrelated edit from an old notification.
              if (store.getState().docVersion === version) store.undo();
              if (
                previousFocus instanceof HTMLElement &&
                previousFocus.isConnected &&
                previousFocus !== document.body
              ) {
                previousFocus.focus();
              } else {
                (portalContainer ?? document).querySelector<HTMLElement>('.bd-canvas')?.focus();
              }
              toast.dismiss('clipboard.undo');
            },
          },
        });
      }
      return result;
    };
    return {
      copy: base.copy,
      cut: withUndo(base.cut, 'clipboard.cut.done'),
      paste: withUndo(base.paste, 'clipboard.paste.done'),
    };
  }, [store, io, props.migrations, toast, t, portalContainer]);

  const report = useMemo(
    () => (result: ClipboardResult) => {
      if (result.ok) {
        toast.dismiss('clipboard');
        return;
      }
      const { error } = result;
      if (error.code === 'locked') {
        toast.dismiss('clipboard');
        notifyLocked(store.getState().selectedIds);
        return;
      }
      toast.show({
        id: 'clipboard',
        variant:
          error.code === 'invalid' || error.code === 'rejected' || error.code === 'outdated'
            ? 'error'
            : 'warning',
        message: t(MESSAGES[error.code]),
        detail: error.detail,
        duration: NOTICE_MS,
      });
    },
    [toast, t, notifyLocked, store],
  );

  return (
    <ClipboardContext.Provider value={clipboard}>
      <ReportContext.Provider value={report}>{props.children}</ReportContext.Provider>
    </ClipboardContext.Provider>
  );
}
