import type { BreakpointConfig } from '../app/config.ts';
import { BreakpointControl } from './breakpoint-control.tsx';
import { type Zoom, ZoomMenu } from './zoom-menu.tsx';

export interface ToolbarCentreProps {
  readonly breakpoints: readonly BreakpointConfig[];
  readonly breakpoint: string;
  readonly onBreakpointChange: (id: string) => void;
  /** The canvas zoom and how to change it (`host.setZoom`); the zoom menu is left out without a handler. */
  readonly zoom?: Zoom | undefined;
  readonly onZoomChange?: ((zoom: Zoom) => void) | undefined;
}

/** The screen-size control and the zoom menu. */
export function ToolbarCentre(props: ToolbarCentreProps) {
  return (
    <div className="bd-toolbar-zone" data-zone="centre">
      <BreakpointControl
        breakpoints={props.breakpoints}
        breakpoint={props.breakpoint}
        onChange={props.onBreakpointChange}
      />
      {props.onZoomChange !== undefined && (
        <ZoomMenu zoom={props.zoom ?? 'fit'} onChange={props.onZoomChange} />
      )}
    </div>
  );
}
