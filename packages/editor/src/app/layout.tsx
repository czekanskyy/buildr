import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useT } from '../messages/index.tsx';
import { Button, Icon, Panel } from '../ui/index.ts';
import { type PanelSide, type ShellPanels, ShellPanelsContext } from './shell-panels.tsx';
import { type Resizable, useResizable } from './use-resizable.ts';

export interface IssueCounts {
  readonly error: number;
  readonly warning: number;
}

export interface EditorLayoutProps {
  readonly toolbar?: ReactNode;
  /** The insert and layers panels. */
  readonly left?: ReactNode;
  /** The canvas. */
  readonly center?: ReactNode;
  /** The inspector. */
  readonly right?: ReactNode;
  /** The issues panel's content. */
  readonly issues?: ReactNode;
  /** Error and warning counts shown on the status bar's issues toggle. */
  readonly issueCounts?: IssueCounts | undefined;
  /** Read-only facts on the right of the status bar (breakpoint, zoom, save state). */
  readonly status?: ReactNode;
}

interface SplitterProps {
  readonly resizable: Resizable;
  readonly min: number;
  readonly max: number;
  readonly label: string;
  readonly controls: string;
}

/**
 * A vertical separator that can be dragged or moved with the keyboard (the WAI-ARIA window
 * splitter); double-click puts it back. It draws a 1px line and has a wider invisible hit area.
 */
function Splitter({ resizable, min, max, label, controls }: SplitterProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a focusable separator is the splitter pattern, and <hr> is not focusable
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-controls={controls}
      aria-valuenow={resizable.size}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      className="bd-splitter"
      data-dragging={resizable.dragging}
      {...resizable.bind}
    />
  );
}

const LEFT = { initial: 280, min: 200, max: 480 } as const;
const RIGHT = { initial: 320, min: 240, max: 520 } as const;
/** Below this editor width the side panels become overlays (the editor may be embedded: measured, not a media query). */
export const NARROW_BELOW = 1100;
/** The canvas never gets narrower than this while the panels sit beside it. */
export const CANVAS_MIN = 480;
const SPLITTERS = 2;

/** The editor's own width, watched with a `ResizeObserver`; 0 while unknown (jsdom). */
function useEditorWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    const root = element?.closest<HTMLElement>('.buildr-editor') ?? element?.parentElement;
    if (root === null || root === undefined) return;
    setWidth(root.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box !== undefined) setWidth(box.width);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/**
 * The shell's three columns and the status bar: toolbar on top, the left panel, the canvas and
 * the inspector between two splitters, the status bar with the collapsible issues drawer at the
 * bottom. Each region is a landmark with a translated name; the panels themselves are slots the
 * later tasks fill. Below `NARROW_BELOW` the side panels are overlays the toolbar toggles.
 */
export function EditorLayout({
  toolbar,
  left,
  center,
  right,
  issues,
  issueCounts,
  status,
}: EditorLayoutProps) {
  const t = useT();
  const ids = { left: useId(), right: useId(), issues: useId() };
  const leftSize = useResizable({ ...LEFT, direction: 1, storageKey: 'buildr:editor:left-width' });
  const rightSize = useResizable({
    ...RIGHT,
    direction: -1,
    storageKey: 'buildr:editor:right-width',
  });
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [overlay, setOverlay] = useState<Record<PanelSide, boolean>>({ left: false, right: false });
  const toolbarRef = useRef<HTMLDivElement>(null);
  const width = useEditorWidth(toolbarRef);
  const narrow = width > 0 && width < NARROW_BELOW;

  const toggle = useCallback(
    (side: PanelSide) =>
      setOverlay((current) => ({
        left: side === 'left' && !current.left,
        right: side === 'right' && !current.right,
      })),
    [],
  );
  const panels = useMemo<ShellPanels>(
    () => ({ narrow, open: overlay, toggle }),
    [narrow, overlay, toggle],
  );

  // Beside the canvas, the panels give way so it keeps CANVAS_MIN (never below their own minimum).
  const room = width > 0 && !narrow ? width - CANVAS_MIN - SPLITTERS : Number.POSITIVE_INFINITY;
  const leftShown = Math.max(LEFT.min, Math.min(leftSize.size, room - RIGHT.min));
  const rightShown = Math.max(RIGHT.min, Math.min(rightSize.size, room - leftShown));

  const style = {
    '--bd-left': `${leftShown}px`,
    '--bd-right': `${rightShown}px`,
  } as CSSProperties;

  const closeOnEscape = (side: PanelSide) => (event: KeyboardEvent) => {
    if (narrow && event.key === 'Escape' && overlay[side]) {
      event.stopPropagation();
      setOverlay((current) => ({ ...current, [side]: false }));
    }
  };

  return (
    <ShellPanelsContext.Provider value={panels}>
      <div className="bd-toolbar" role="toolbar" aria-label={t('editor.toolbar')} ref={toolbarRef}>
        {toolbar}
      </div>
      <div className="bd-body" style={style} data-narrow={narrow}>
        <Panel
          as="aside"
          id={ids.left}
          aria-label={t('editor.leftPanel')}
          hidden={narrow && !overlay.left}
          data-side="left"
          onKeyDown={closeOnEscape('left')}
        >
          {left}
        </Panel>
        <Splitter
          resizable={leftSize}
          min={LEFT.min}
          max={LEFT.max}
          label={t('editor.resize.left')}
          controls={ids.left}
        />
        <main className="bd-canvas" aria-label={t('editor.canvas')}>
          {center}
        </main>
        <Splitter
          resizable={rightSize}
          min={RIGHT.min}
          max={RIGHT.max}
          label={t('editor.resize.right')}
          controls={ids.right}
        />
        <Panel
          as="aside"
          id={ids.right}
          aria-label={t('editor.inspector')}
          hidden={narrow && !overlay.right}
          data-side="right"
          onKeyDown={closeOnEscape('right')}
        >
          {right}
        </Panel>
      </div>
      <section className="bd-issues" data-open={issuesOpen} aria-label={t('editor.issues')}>
        <div className="bd-issues-bar">
          <Button
            variant="ghost"
            className="bd-status-toggle"
            aria-expanded={issuesOpen}
            aria-controls={ids.issues}
            onClick={() => setIssuesOpen((open) => !open)}
          >
            {issueCounts !== undefined && (
              <>
                <span
                  className="bd-status-count"
                  data-severity="error"
                  title={t('editor.status.errors')}
                >
                  <Icon name="circle-alert" />
                  {issueCounts.error}
                </span>
                <span
                  className="bd-status-count"
                  data-severity="warning"
                  title={t('editor.status.warnings')}
                >
                  <Icon name="triangle-alert" />
                  {issueCounts.warning}
                </span>
              </>
            )}
            {issuesOpen ? t('editor.issues.hide') : t('editor.issues.show')}
          </Button>
          <span className="bd-toolbar-spacer" />
          {status}
        </div>
        <div id={ids.issues} hidden={!issuesOpen}>
          {issues}
        </div>
      </section>
    </ShellPanelsContext.Provider>
  );
}
