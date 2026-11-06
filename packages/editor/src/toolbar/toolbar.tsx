import { useRef, useState } from 'react';
import type { BreakpointConfig } from '../app/config.ts';
import { useShellPanels } from '../app/shell-panels.tsx';
import { usePersistenceState } from '../persistence/index.ts';
import { useEditorState } from '../store/index.ts';
import { PageOptionsDialog } from './page-options-dialog.tsx';
import { type SamplePickerProps, useSamples } from './sample-picker.tsx';
import { ToolbarCentre } from './toolbar-centre.tsx';
import { ToolbarLeft } from './toolbar-left.tsx';
import { ToolbarRight } from './toolbar-right.tsx';
import { useOverflowLevel } from './use-overflow-level.ts';

export interface ToolbarProps {
  /** The document's title, shown in the page chip and renamed in the page options. */
  readonly title: string;
  /** Saves a new page name (`adapter.rename`); the name is read-only without it. */
  readonly onTitleChange?: ((title: string) => Promise<void>) | undefined;
  /** The page's address, read-only in the page options; the row is left out without it. */
  readonly slug?: string | undefined;
  /** Draft or published, as a small chip in the page chip. */
  readonly status?: 'draft' | 'published' | undefined;
  readonly breakpoints: readonly BreakpointConfig[];
  readonly breakpoint: string;
  readonly onBreakpointChange: (id: string) => void;
  /** The page in the CMS's admin (`adapter.cmsUrl`); the link is left out without it. */
  readonly cmsUrl?: string | undefined;
  /** The version history: an address (a link) or a function (a button); the icon is left out without it. */
  readonly historyUrl?: string | (() => void) | undefined;
  /** The help page; the Help row of the more menu is left out without it. */
  readonly helpUrl?: string | undefined;
  /** Opens the shortcuts dialog from the more menu; without it the shortcut provider's own opener is used. */
  readonly onOpenShortcuts?: (() => void) | undefined;
  /** Tells the canvas which content language to render (`CanvasHost.setLocale`). */
  readonly onLocaleChange?: ((locale: string) => void) | undefined;
  /** The sample data source (templates); without it there is no sample data. */
  readonly sample?: SamplePickerProps | undefined;
  /** The page options dialog's state, when the shell controls it (the inspector's "Page settings" opens it too). */
  readonly pageOptionsOpen?: boolean | undefined;
  readonly onPageOptionsOpenChange?: ((open: boolean) => void) | undefined;
  /** Flushes the save and opens the preview (PB-091). */
  readonly onPreview?: (() => void) | undefined;
  /** Opens the publish dialog (PB-088). */
  readonly onPublish?: (() => void) | undefined;
  /** The session may publish (`adapter.getSession().canPublish`). */
  readonly canPublish?: boolean | undefined;
}

/**
 * What changes as the row runs out of room, in order (a step is taken only when a zone overflows):
 * 1 the version history moves into the more menu, 2 the save text becomes icon only, 3 the link
 * back to the CMS moves into the more menu, 4 the page name and the product name are hidden.
 */
const COLLAPSE = { versions: 1, saveText: 2, cms: 3, title: 4 } as const;

/**
 * The editor's primary actions (docs/editor.md#toolbar-pb-083) in a `1fr / auto / 1fr` grid. Left:
 * back, mark, left panel toggle, undo, redo. Centre: the page chip (opens the page options). Right:
 * screen size, save status, content language, history, Preview, more, right panel toggle, Publish.
 * It reads the store and the persistence controller from context; shortcuts show in the tooltips.
 */
export function Toolbar(props: ToolbarProps) {
  const row = useRef<HTMLDivElement>(null);
  const level = useOverflowLevel(row, COLLAPSE.title);
  const status = usePersistenceState((state) => state.status);
  const readOnly = useEditorState((state) => state.readOnly);
  const [ownOpen, setOwnOpen] = useState(false);
  const optionsOpen = props.pageOptionsOpen ?? ownOpen;
  const setOptionsOpen = (open: boolean) => {
    setOwnOpen(open);
    props.onPageOptionsOpenChange?.(open);
  };
  const samples = useSamples(props.sample);
  // A phone-wide editor (the layout says so) collapses the row by design, not by measuring.
  const panels = useShellPanels();
  const compact = panels?.compact === true;
  const tight = panels?.tight === true;
  const cmsMoved = compact || level >= COLLAPSE.cms;

  return (
    <div className="bd-toolbar-row" ref={row} data-level={level} data-compact={compact}>
      <ToolbarLeft cmsUrl={cmsMoved ? undefined : props.cmsUrl} compact={compact} />
      <ToolbarCentre
        title={props.title}
        status={props.status}
        open={optionsOpen}
        onOpen={() => setOptionsOpen(true)}
      />
      <ToolbarRight
        breakpoints={props.breakpoints}
        breakpoint={props.breakpoint}
        onBreakpointChange={props.onBreakpointChange}
        status={status}
        onLocaleChange={props.onLocaleChange}
        onPreview={props.onPreview}
        onPublish={props.onPublish}
        canPublish={props.canPublish}
        compactSave={compact || level >= COLLAPSE.saveText}
        compact={compact}
        tight={tight}
        historyUrl={props.historyUrl}
        historyInMenu={compact || level >= COLLAPSE.versions}
        moreCmsUrl={cmsMoved ? props.cmsUrl : undefined}
        sample={
          samples.samples.length > 0
            ? { entry: samples.label, onOpen: () => setOptionsOpen(true) }
            : undefined
        }
        helpUrl={props.helpUrl}
        onOpenShortcuts={props.onOpenShortcuts}
      />
      <PageOptionsDialog
        open={optionsOpen}
        onOpenChange={setOptionsOpen}
        title={props.title}
        onRename={props.onTitleChange}
        slug={props.slug}
        readOnly={readOnly}
        samples={samples}
      />
    </div>
  );
}
