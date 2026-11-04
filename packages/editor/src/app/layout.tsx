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
import { usePlural, useT } from '../messages/index.tsx';
import { Icon, IconButton, Panel } from '../ui/index.ts';
import type { LeftPanelTab, StageSlots } from './contracts.ts';
import { type PanelSide, type ShellPanels, ShellPanelsContext } from './shell-panels.tsx';
import { StageSlotsContext } from './stage-slots.tsx';
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
  /** The right of the status bar: device readout and zoom menu. */
  readonly status?: ReactNode;
  /** The selection path on the left of the status bar. */
  readonly breadcrumbs?: ReactNode;
}

type Collapsed = Readonly<Record<PanelSide, boolean>>;

const COLLAPSE_KEY = 'buildr:editor:collapsed';
const EXPANDED: Collapsed = { left: false, right: false };

/** The stored collapse of both panels; anything that is not an object with boolean sides is ignored. */
function readCollapsed(): Collapsed {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(COLLAPSE_KEY) ?? 'null');
    if (typeof parsed !== 'object' || parsed === null) return EXPANDED;
    const { left, right } = parsed as Record<string, unknown>;
    return { left: left === true, right: right === true };
  } catch {
    return EXPANDED;
  }
}

function writeCollapsed(value: Collapsed): void {
  try {
    window.localStorage.setItem(COLLAPSE_KEY, JSON.stringify(value));
  } catch {
    // Storage is unavailable: the collapse just is not remembered.
  }
}

interface SplitterProps {
  readonly resizable: Resizable;
  readonly min: number;
  readonly max: number;
  readonly label: string;
  readonly controls: string;
  /** The panel is a rail: the splitter is a plain line. */
  readonly inert?: boolean;
}

/**
 * A vertical separator that can be dragged or moved with the keyboard (the WAI-ARIA window
 * splitter); double-click puts it back. It draws a 1px line and has a wider invisible hit area.
 */
function Splitter({ resizable, min, max, label, controls, inert = false }: SplitterProps) {
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
      tabIndex={inert ? -1 : 0}
      aria-hidden={inert ? true : undefined}
      className="bd-splitter"
      data-dragging={resizable.dragging}
      data-inert={inert}
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
  breadcrumbs,
}: EditorLayoutProps) {
  const t = useT();
  const plural = usePlural();
  const ids = { left: useId(), right: useId(), issues: useId() };
  const leftSize = useResizable({ ...LEFT, direction: 1, storageKey: 'buildr:editor:left-width' });
  const rightSize = useResizable({
    ...RIGHT,
    direction: -1,
    storageKey: 'buildr:editor:right-width',
  });
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [overlay, setOverlay] = useState<Record<PanelSide, boolean>>({ left: false, right: false });
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;
  const [leftTab, setLeftTab] = useState<LeftPanelTab>('blocks');
  const [stage, setStage] = useState<HTMLElement | null>(null);
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
  const update = useCallback((change: (current: Collapsed) => Collapsed) => {
    setCollapsed((current) => {
      const next = change(current);
      writeCollapsed(next);
      return next;
    });
  }, []);
  // Focus follows a user-initiated expand or collapse only (never mount or restored state).
  const focusAfter = useRef<{ readonly side: PanelSide; readonly open: boolean } | null>(null);
  const toggleCollapsed = useCallback(
    (side: PanelSide) => {
      focusAfter.current = { side, open: collapsedRef.current[side] };
      update((current) => ({ ...current, [side]: !current[side] }));
    },
    [update],
  );
  const collapseAll = useCallback(() => {
    focusAfter.current = { side: 'left', open: false };
    update(() => ({ left: true, right: true }));
  }, [update]);
  const expandAll = useCallback(() => {
    focusAfter.current = { side: 'left', open: true };
    update(() => EXPANDED);
  }, [update]);
  const panels = useMemo<ShellPanels>(
    () => ({
      narrow,
      open: overlay,
      toggle,
      collapsed,
      toggleCollapsed,
      collapseAll,
      expandAll,
      leftTab,
      setLeftTab,
    }),
    [narrow, overlay, toggle, collapsed, toggleCollapsed, collapseAll, expandAll, leftTab],
  );
  const slots = useMemo<StageSlots>(
    () => ({ stage, issuesOpen, setIssuesOpen }),
    [stage, issuesOpen],
  );
  // The overlay mode always shows a panel in full; the rail is the wide layout's collapsed state.
  const rail = { left: !narrow && collapsed.left, right: !narrow && collapsed.right };

  // Beside the canvas, the panels give way so it keeps CANVAS_MIN (never below their own minimum).
  const room = width > 0 && !narrow ? width - CANVAS_MIN - SPLITTERS : Number.POSITIVE_INFINITY;
  const leftShown = Math.max(LEFT.min, Math.min(leftSize.size, room - RIGHT.min));
  const rightShown = Math.max(RIGHT.min, Math.min(rightSize.size, room - leftShown));

  const style = {
    '--bd-left': rail.left ? 'var(--bd-rail)' : `${leftShown}px`,
    '--bd-right': rail.right ? 'var(--bd-rail)' : `${rightShown}px`,
  } as CSSProperties;

  const expand = (side: PanelSide) => {
    focusAfter.current = { side, open: true };
    update((current) => ({ ...current, [side]: false }));
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs after a collapse change only; the ids are stable
  useEffect(() => {
    const pending = focusAfter.current;
    if (pending === null) return;
    focusAfter.current = null;
    const panel = document.getElementById(ids[pending.side]);
    if (panel === null) return;
    if (pending.open) {
      const content = panel.querySelector<HTMLElement>('.bd-panel-content');
      const first = content?.querySelector<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      (first ?? content)?.focus();
    } else {
      panel.querySelector<HTMLElement>('.bd-rail button')?.focus();
    }
  }, [collapsed]);
  const issueText = (count: number, kind: 'error' | 'warning') =>
    plural(`issues.count.${kind}`, count);

  const closeOnEscape = (side: PanelSide) => (event: KeyboardEvent) => {
    if (narrow && event.key === 'Escape' && overlay[side]) {
      event.stopPropagation();
      setOverlay((current) => ({ ...current, [side]: false }));
    }
  };

  return (
    <ShellPanelsContext.Provider value={panels}>
      <StageSlotsContext.Provider value={slots}>
        <div
          className="bd-toolbar"
          role="toolbar"
          aria-label={t('editor.toolbar')}
          ref={toolbarRef}
        >
          {toolbar}
        </div>
        <div
          className="bd-body"
          style={style}
          data-narrow={narrow}
          data-dragging={leftSize.dragging || rightSize.dragging}
        >
          <Panel
            as="aside"
            id={ids.left}
            aria-label={t('editor.leftPanel')}
            hidden={narrow && !overlay.left}
            data-side="left"
            data-collapsed={rail.left}
            onKeyDown={closeOnEscape('left')}
          >
            <div className="bd-panel-content" hidden={rail.left} tabIndex={-1}>
              {left}
            </div>
            {rail.left && (
              <div className="bd-rail">
                <IconButton
                  label={t('leftPanel.tab.blocks')}
                  icon="layout-grid"
                  onClick={() => {
                    setLeftTab('blocks');
                    expand('left');
                  }}
                />
                <IconButton
                  label={t('leftPanel.tab.structure')}
                  icon="list-tree"
                  onClick={() => {
                    setLeftTab('structure');
                    expand('left');
                  }}
                />
              </div>
            )}
          </Panel>
          <Splitter
            resizable={leftSize}
            min={LEFT.min}
            max={LEFT.max}
            label={t('editor.resize.left')}
            controls={ids.left}
            inert={rail.left}
          />
          <main className="bd-canvas" aria-label={t('editor.canvas')} tabIndex={-1} ref={setStage}>
            <div className="bd-stage-scroll">{center}</div>
            <section
              className="bd-issues"
              data-open={issuesOpen}
              aria-label={t('issues.drawer')}
              id={ids.issues}
              inert={!issuesOpen}
            >
              {issues}
            </section>
          </main>
          <Splitter
            resizable={rightSize}
            min={RIGHT.min}
            max={RIGHT.max}
            label={t('editor.resize.right')}
            controls={ids.right}
            inert={rail.right}
          />
          <Panel
            as="aside"
            id={ids.right}
            aria-label={t('editor.inspector')}
            hidden={narrow && !overlay.right}
            data-side="right"
            data-collapsed={rail.right}
            onKeyDown={closeOnEscape('right')}
          >
            <div className="bd-panel-content" hidden={rail.right} tabIndex={-1}>
              {right}
            </div>
            {rail.right && (
              <div className="bd-rail">
                <IconButton
                  label={t('inspector.expand')}
                  icon="panel-right"
                  onClick={() => expand('right')}
                />
              </div>
            )}
          </Panel>
        </div>
        <section className="bd-status" aria-label={t('statusBar.label')}>
          <div className="bd-status-crumbs">{breadcrumbs}</div>
          <button
            type="button"
            className="bd-status-btn"
            aria-expanded={issuesOpen}
            aria-controls={ids.issues}
            title={t('statusBar.issues.show')}
            onClick={() => setIssuesOpen((open) => !open)}
          >
            {issueCounts === undefined ? (
              t('editor.issues.show')
            ) : issueCounts.error + issueCounts.warning === 0 ? (
              <>
                <Icon name="circle-check" />
                {t('statusBar.noIssues')}
              </>
            ) : (
              <>
                {issueCounts.error > 0 && (
                  <span className="bd-status-count" data-severity="error">
                    <Icon name="circle-alert" />
                    <span className="bd-tabular">{issueText(issueCounts.error, 'error')}</span>
                  </span>
                )}
                {issueCounts.warning > 0 && (
                  <span className="bd-status-count" data-severity="warning">
                    <Icon name="triangle-alert" />
                    <span className="bd-tabular">{issueText(issueCounts.warning, 'warning')}</span>
                  </span>
                )}
              </>
            )}
          </button>
          <span className="bd-status-divider" aria-hidden="true" />
          {status}
        </section>
      </StageSlotsContext.Provider>
    </ShellPanelsContext.Provider>
  );
}
