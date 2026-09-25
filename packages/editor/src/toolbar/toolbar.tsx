import { type ReactNode, useRef } from 'react';
import type { BreakpointConfig } from '../app/config.ts';
import { usePersistenceState } from '../persistence/index.ts';
import { PanelToggle } from './panel-toggles.tsx';
import { ToolbarCentre } from './toolbar-centre.tsx';
import { ToolbarLeft } from './toolbar-left.tsx';
import { ToolbarRight } from './toolbar-right.tsx';
import { useOverflowLevel } from './use-overflow-level.ts';
import type { Zoom } from './zoom-menu.tsx';

export interface ToolbarProps {
  /** The document's title, shown after the link back. */
  readonly title: string;
  /** Draft or published, as a pill next to the title. */
  readonly status?: 'draft' | 'published' | undefined;
  readonly breakpoints: readonly BreakpointConfig[];
  readonly breakpoint: string;
  readonly onBreakpointChange: (id: string) => void;
  /** The canvas zoom (`host.setZoom`); `fit` when left out. */
  readonly zoom?: Zoom | undefined;
  /** Changes the canvas zoom; the zoom menu is left out without it. */
  readonly onZoomChange?: ((zoom: Zoom) => void) | undefined;
  /** The page in the CMS's admin (`adapter.cmsUrl`); the link is left out without it. */
  readonly cmsUrl?: string | undefined;
  /** The version history in the CMS; the link is left out without it. */
  readonly historyUrl?: string | undefined;
  /** The locale and sample pickers, rendered on the right between the save status and Preview. */
  readonly pickers?: ReactNode;
  /** Flushes the save and opens the preview (PB-091). */
  readonly onPreview?: (() => void) | undefined;
  /** Opens the publish dialog (PB-088). */
  readonly onPublish?: (() => void) | undefined;
  /** The session may publish (`adapter.getSession().canPublish`). */
  readonly canPublish?: boolean | undefined;
}

/**
 * What changes as the row runs out of room, in order (a step is taken only when the content
 * overflows): 1 the version history moves into the more menu, 2 the save text becomes icon only,
 * 3 the link back to the CMS moves into the more menu, 4 the title may shrink.
 */
const COLLAPSE = { versions: 1, saveText: 2, cms: 3, title: 4 } as const;

/**
 * The editor's primary actions (docs/editor.md#toolbar-pb-083) in three zones: the link back, title
 * and status on the left; screen size and zoom in the centre; undo/redo, save status, pickers,
 * Preview, Publish and the more menu on the right. It reads the store and the persistence
 * controller from context; the shortcuts show in the tooltips.
 */
export function Toolbar(props: ToolbarProps) {
  const row = useRef<HTMLDivElement>(null);
  const level = useOverflowLevel(row, COLLAPSE.title);
  const status = usePersistenceState((state) => state.status);
  const cmsMoved = level >= COLLAPSE.cms;

  return (
    <div className="bd-toolbar-row" ref={row} data-level={level}>
      <PanelToggle side="left" />
      <ToolbarLeft
        title={props.title}
        status={props.status}
        cmsUrl={cmsMoved ? undefined : props.cmsUrl}
      />
      <span className="bd-toolbar-spacer" />
      <ToolbarCentre
        breakpoints={props.breakpoints}
        breakpoint={props.breakpoint}
        onBreakpointChange={props.onBreakpointChange}
        zoom={props.zoom}
        onZoomChange={props.onZoomChange}
      />
      <span className="bd-toolbar-spacer" />
      <ToolbarRight
        pickers={props.pickers}
        status={status}
        onPreview={props.onPreview}
        onPublish={props.onPublish}
        canPublish={props.canPublish}
        compactSave={level >= COLLAPSE.saveText}
        historyUrl={props.historyUrl}
        historyInMenu={level >= COLLAPSE.versions}
        moreCmsUrl={cmsMoved ? props.cmsUrl : undefined}
      />
      <PanelToggle side="right" />
    </div>
  );
}
