import type { NodeId } from '@next-buildr/core';
import { useCallback } from 'react';
import { useT } from '../messages/index.tsx';
import { useOptionalEditor } from '../store/react.tsx';
import { structureLockReason } from '../store/structure-lock.ts';
import { useOptionalToast } from './toast.tsx';

/**
 * Returns the function that tells the person why a locked block was not removed, moved, cut or
 * duplicated (an info toast; nothing happens outside a `<ToastProvider>`). It points to the
 * Structure panel only when the host lets the person unlock (`canUnlock`). Given the refused ids it
 * names the right reason: the block itself, or a block it sits in.
 */
export function useStructureLockedNotice(): (ids?: readonly NodeId[]) => void {
  const t = useT();
  const toast = useOptionalToast();
  const editor = useOptionalEditor();
  const canUnlock = editor?.canUnlock ?? false;
  return useCallback(
    (ids?: readonly NodeId[]) => {
      const reason =
        ids === undefined || editor === undefined
          ? 'self'
          : (structureLockReason(editor.getState().doc, ids) ?? 'self');
      const key = reason === 'inherited' ? 'toast.structureLockedParent' : 'toast.structureLocked';
      toast?.show({
        id: 'structure-locked',
        variant: 'info',
        message: t(canUnlock ? key : (`${key}Fixed` as const)),
      });
    },
    [toast, t, canUnlock, editor],
  );
}
