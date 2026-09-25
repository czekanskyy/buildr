import { useSyncExternalStore } from 'react';
import type { CanvasHost } from '../canvas-host/index.ts';
import { type MessageKey, useT } from '../messages/index.tsx';
import { usePersistenceState } from '../persistence/index.ts';
import { useEditorState } from '../store/index.ts';
import type { BreakpointConfig } from './config.ts';

export interface StatusInfoProps {
  readonly host: CanvasHost | null;
  readonly breakpoints: readonly BreakpointConfig[];
  readonly breakpoint: string;
}

const BREAKPOINT_LABELS: Readonly<Record<string, MessageKey>> = {
  desktop: 'toolbar.breakpoint.desktop',
  tablet: 'toolbar.breakpoint.tablet',
  mobile: 'toolbar.breakpoint.mobile',
};

const NO_ZOOM = 'fit' as const;

function useZoom(host: CanvasHost | null): 'fit' | number {
  return useSyncExternalStore(
    (notify) => (host === null ? () => undefined : host.state.subscribe(notify)),
    () => host?.state.getState().zoom ?? NO_ZOOM,
    () => NO_ZOOM,
  );
}

/**
 * The status bar's read-only facts (PB-122): the active breakpoint and its width, the canvas
 * zoom and the save state. They come from the host, the store and the persistence controller;
 * the save state is plain text (the toolbar's status carries the live region).
 */
export function StatusInfo({ host, breakpoints, breakpoint }: StatusInfoProps) {
  const t = useT();
  const zoom = useZoom(host);
  const status = usePersistenceState((state) => state.status);
  const error = usePersistenceState((state) => state.error);
  const readOnly = useEditorState((state) => state.readOnly);
  const active = breakpoints.find((item) => item.id === breakpoint);
  const key = BREAKPOINT_LABELS[breakpoint];
  const save = readOnly
    ? t('save.readOnly')
    : status === 'error' && error?.kind === 'invalid'
      ? t('save.invalid')
      : t(`save.${status}`);
  return (
    <>
      <span className="bd-status-item" title={t('editor.status.breakpoint')}>
        {key === undefined ? breakpoint : t(key)}
        {active === undefined ? '' : ` ${active.width}px`}
      </span>
      <span className="bd-status-item bd-tabular" title={t('editor.status.zoom')}>
        {zoom === 'fit' ? t('editor.status.fit') : `${Math.round(zoom * 100)}%`}
      </span>
      <span className="bd-status-item" data-status={readOnly ? 'readOnly' : status}>
        {save}
      </span>
    </>
  );
}
