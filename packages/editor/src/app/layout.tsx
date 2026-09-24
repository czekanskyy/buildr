import { type CSSProperties, type ReactNode, useId, useState } from 'react';
import { useT } from '../messages/index.tsx';
import { Button } from '../ui/index.ts';
import { type Resizable, useResizable } from './use-resizable.ts';

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
}

interface SplitterProps {
  readonly resizable: Resizable;
  readonly min: number;
  readonly max: number;
  readonly label: string;
  readonly controls: string;
}

/** A vertical separator that can be dragged or moved with the keyboard (the WAI-ARIA window splitter). */
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

/**
 * The shell's three columns and the collapsible issues bar: toolbar on top, the left panel, the
 * canvas and the inspector between two splitters, the issues panel at the bottom. Each region is
 * a landmark with a translated name; the panels themselves are slots the later tasks fill.
 */
export function EditorLayout({ toolbar, left, center, right, issues }: EditorLayoutProps) {
  const t = useT();
  const ids = { left: useId(), right: useId(), issues: useId() };
  const leftSize = useResizable({ ...LEFT, direction: 1 });
  const rightSize = useResizable({ ...RIGHT, direction: -1 });
  const [issuesOpen, setIssuesOpen] = useState(false);

  const style = {
    '--bd-left': `${leftSize.size}px`,
    '--bd-right': `${rightSize.size}px`,
  } as CSSProperties;

  return (
    <>
      <div className="bd-toolbar" role="toolbar" aria-label={t('editor.toolbar')}>
        {toolbar}
      </div>
      <div className="bd-body" style={style}>
        <aside id={ids.left} className="bd-panel" aria-label={t('editor.leftPanel')}>
          {left}
        </aside>
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
        <aside id={ids.right} className="bd-panel" aria-label={t('editor.inspector')}>
          {right}
        </aside>
      </div>
      <section className="bd-issues" data-open={issuesOpen} aria-label={t('editor.issues')}>
        <div className="bd-issues-bar">
          <Button
            variant="ghost"
            aria-expanded={issuesOpen}
            aria-controls={ids.issues}
            onClick={() => setIssuesOpen((open) => !open)}
          >
            {issuesOpen ? t('editor.issues.hide') : t('editor.issues.show')}
          </Button>
        </div>
        <div id={ids.issues} hidden={!issuesOpen}>
          {issues}
        </div>
      </section>
    </>
  );
}
