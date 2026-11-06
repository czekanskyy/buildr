import { useEffect, useState, useSyncExternalStore } from 'react';
import type { CanvasHost } from '../canvas-host/index.ts';
import { interpolate, type MessageKey, useT } from '../messages/index.tsx';
import { ZoomMenu } from '../toolbar/zoom-menu.tsx';
import { Icon, type IconName } from '../ui/index.ts';
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

const BREAKPOINT_ICONS: Readonly<Record<string, IconName>> = {
  desktop: 'monitor',
  tablet: 'tablet',
  mobile: 'smartphone',
};

const NO_ZOOM = 'fit' as const;

function useZoom(host: CanvasHost | null): 'fit' | number {
  return useSyncExternalStore(
    (notify) => (host === null ? () => undefined : host.state.subscribe(notify)),
    () => host?.state.getState().zoom ?? NO_ZOOM,
    () => NO_ZOOM,
  );
}

/** The scale the canvas frame is shown at, in percent, read from the frame (`Fit` is not a number). */
function useShownPercent(
  host: CanvasHost | null,
  zoom: 'fit' | number,
  breakpoint: string,
): number {
  const [percent, setPercent] = useState(100);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `zoom` and the breakpoint change the frame's scale
  useEffect(() => {
    if (typeof zoom === 'number') {
      setPercent(Math.round(zoom * 100));
      return;
    }
    const read = () => {
      const frame = document.querySelector<HTMLElement>('.bd-canvas-frame');
      if (frame === null || frame.offsetWidth === 0) return;
      setPercent(Math.round((frame.getBoundingClientRect().width / frame.offsetWidth) * 100));
    };
    const timer = setTimeout(read, 0);
    window.addEventListener('resize', read);
    const area = document.querySelector('.bd-canvas-stage-area');
    const observer =
      typeof ResizeObserver === 'undefined' || area === null ? undefined : new ResizeObserver(read);
    if (area !== null) observer?.observe(area);
    const unsubscribe = host?.state.subscribe(read);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', read);
      observer?.disconnect();
      unsubscribe?.();
    };
  }, [host, zoom, breakpoint]);
  return percent;
}

/**
 * The status bar's right side: the active screen size with its icon and width (`Komputer · pełna
 * szerokość`), and the canvas zoom menu (the host's `setZoom`). The save state lives in the toolbar.
 */
export function StatusInfo({ host, breakpoints, breakpoint }: StatusInfoProps) {
  const t = useT();
  const zoom = useZoom(host);
  const shown = useShownPercent(host, zoom, breakpoint);
  const active = breakpoints.find((item) => item.id === breakpoint);
  const key = BREAKPOINT_LABELS[breakpoint];
  const name = key === undefined ? breakpoint : t(key);
  const detail =
    active === undefined || active === breakpoints[0]
      ? t('statusBar.device.full')
      : interpolate(t('statusBar.device.width'), { width: active.width });
  const icon = BREAKPOINT_ICONS[breakpoint];
  return (
    <>
      <span
        className="bd-status-btn bd-status-static bd-tabular"
        title={t('editor.status.breakpoint')}
      >
        {icon === undefined ? null : <Icon name={icon} />}
        {name} · {detail}
      </span>
      <ZoomMenu
        zoom={zoom}
        shown={shown}
        variant="status"
        onChange={(next) => host?.setZoom(next)}
      />
    </>
  );
}
