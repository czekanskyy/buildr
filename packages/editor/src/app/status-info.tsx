import { useSyncExternalStore } from 'react';
import type { CanvasHost } from '../canvas-host/index.ts';
import { type MessageKey, useT } from '../messages/index.tsx';
import { ZoomMenu } from '../toolbar/zoom-menu.tsx';
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
 * The status bar's right side: the active breakpoint and its width, and the canvas zoom menu
 * (the host's `setZoom`). The save state lives in the toolbar.
 */
export function StatusInfo({ host, breakpoints, breakpoint }: StatusInfoProps) {
  const t = useT();
  const zoom = useZoom(host);
  const active = breakpoints.find((item) => item.id === breakpoint);
  const key = BREAKPOINT_LABELS[breakpoint];
  return (
    <>
      <span
        className="bd-status-btn bd-status-static bd-tabular"
        title={t('editor.status.breakpoint')}
      >
        {key === undefined ? breakpoint : t(key)}
        {active === undefined ? '' : ` ${active.width}px`}
      </span>
      <ZoomMenu zoom={zoom} variant="status" onChange={(next) => host?.setZoom(next)} />
    </>
  );
}
