import { createContext, type ReactNode, useContext, useEffect } from 'react';
import { useStore } from 'zustand';
import { useT } from '../messages/index.tsx';
import { useEditorState } from '../store/index.ts';
import { Button, Dialog } from '../ui/index.ts';
import type { PersistenceController } from './controller.ts';
import type { PersistenceState } from './types.ts';

const PersistenceContext = createContext<PersistenceController | undefined>(undefined);

export function usePersistence(): PersistenceController {
  const controller = useContext(PersistenceContext);
  if (controller === undefined) {
    throw new Error('usePersistence must be used inside <PersistenceProvider>');
  }
  return controller;
}

export function usePersistenceState<T>(selector: (state: PersistenceState) => T): T {
  return useStore(usePersistence().state, selector);
}

/**
 * Runs the autosave of `controller`, warns before the tab is closed while work would be lost, and
 * shows the conflict dialog. `useSaveAction` gives the handler for the Ctrl+S shortcut.
 */
export function PersistenceProvider(props: {
  readonly controller: PersistenceController;
  readonly children: ReactNode;
}) {
  const { controller, children } = props;
  useEffect(() => controller.start(), [controller]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!controller.hasUnsavedWork()) return;
      event.preventDefault();
      // Some browsers still want a return value to show their prompt.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [controller]);
  useEffect(() => {
    // Coming back to the tab or window is when somebody else's save is most likely to matter.
    const check = () => void controller.checkExternal();
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [controller]);
  return (
    <PersistenceContext.Provider value={controller}>
      {children}
      <ExternalChangeBanner />
      <ConflictDialog />
    </PersistenceContext.Provider>
  );
}

/** For `<ShortcutProvider actions={{ save }}>`: Ctrl+S saves now and takes the key from the browser. */
export function useSaveAction(): () => boolean {
  const controller = usePersistence();
  return () => {
    void controller.saveNow();
    return true;
  };
}

/** A non-blocking notice that somebody else saved while this document is unchanged: one click reloads. */
function ExternalChangeBanner() {
  const t = useT();
  const controller = usePersistence();
  const external = usePersistenceState((state) => state.external);
  return (
    <div className="bd-external-banner" role="status">
      {external !== undefined && (
        <>
          <span>
            {external.updatedBy === undefined
              ? t('external.banner')
              : t('external.banner.by').replace('{name}', external.updatedBy)}
          </span>
          <Button onClick={() => void controller.reload()}>{t('external.reload')}</Button>
        </>
      )}
    </div>
  );
}

function ConflictDialog() {
  const t = useT();
  const controller = usePersistence();
  const status = usePersistenceState((state) => state.status);
  return (
    <Dialog
      open={status === 'conflict'}
      // The choice is the only way out: closing without one would leave the editor stuck in conflict.
      onOpenChange={() => undefined}
      title={t('save.conflict.title')}
      description={t('save.conflict.description')}
    >
      <div className="bd-conflict-actions">
        <Button onClick={() => void controller.reload()}>{t('save.conflict.reload')}</Button>
        <Button variant="danger" onClick={() => void controller.overwrite()}>
          {t('save.conflict.overwrite')}
        </Button>
      </div>
    </Dialog>
  );
}

/** A short status line for the toolbar (PB-083): saved, unsaved, saving, failed, conflict. */
export function SaveStatus() {
  const t = useT();
  const controller = usePersistence();
  const status = usePersistenceState((state) => state.status);
  const error = usePersistenceState((state) => state.error);
  const readOnly = useEditorState((state) => state.readOnly);
  const text = readOnly
    ? t('save.readOnly')
    : status === 'error' && error?.kind === 'invalid'
      ? t('save.invalid')
      : t(`save.${status}`);
  return (
    <span className="bd-save-status" data-status={readOnly ? 'readOnly' : status} role="status">
      {text}
      {!readOnly && (status === 'dirty' || status === 'error') && (
        <Button variant="ghost" onClick={() => void controller.saveNow()}>
          {t('save.now')}
        </Button>
      )}
    </span>
  );
}
