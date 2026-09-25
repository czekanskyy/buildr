import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { type MessageKey, useT } from '../messages/index.tsx';
import type { ExternalActions } from '../shortcuts/index.ts';
import { useEditor } from '../store/index.ts';
import { TOAST_MS, useToast } from '../ui/index.ts';
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
  readonly children: ReactNode;
}) {
  const store = useEditor();
  const t = useT();
  const toast = useToast();
  const io = props.io ?? browserClipboard();
  const clipboard = useMemo(() => createClipboard({ store, io }), [store, io]);

  const report = useMemo(
    () => (result: ClipboardResult) => {
      if (result.ok) {
        toast.dismiss('clipboard');
        return;
      }
      const { error } = result;
      toast.show({
        id: 'clipboard',
        variant: error.code === 'invalid' || error.code === 'rejected' ? 'error' : 'warning',
        message: t(MESSAGES[error.code]),
        detail: error.detail,
        duration: NOTICE_MS,
      });
    },
    [toast, t],
  );

  return (
    <ClipboardContext.Provider value={clipboard}>
      <ReportContext.Provider value={report}>{props.children}</ReportContext.Provider>
    </ClipboardContext.Provider>
  );
}
