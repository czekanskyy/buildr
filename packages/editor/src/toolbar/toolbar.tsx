import type { BreakpointConfig } from '../app/config.ts';
import { type MessageKey, useT } from '../messages/index.tsx';
import { SaveStatus, usePersistenceState } from '../persistence/index.ts';
import { useShortcutHint } from '../shortcuts/index.ts';
import { useEditor, useEditorState } from '../store/index.ts';
import { Button, Icon, IconButton } from '../ui/index.ts';
import { PanelToggle } from './panel-toggles.tsx';

const BREAKPOINT_LABELS: Readonly<Record<string, MessageKey>> = {
  desktop: 'toolbar.breakpoint.desktop',
  tablet: 'toolbar.breakpoint.tablet',
  mobile: 'toolbar.breakpoint.mobile',
};

export interface ToolbarProps {
  /** The document's title, shown between the link back and the breakpoint switcher. */
  readonly title: string;
  readonly breakpoints: readonly BreakpointConfig[];
  readonly breakpoint: string;
  readonly onBreakpointChange: (id: string) => void;
  /** The page in the CMS's admin (`adapter.cmsUrl`); the link is left out without it. */
  readonly cmsUrl?: string | undefined;
  /** The version history in the CMS; the link is left out without it. */
  readonly historyUrl?: string | undefined;
  /** Flushes the save and opens the preview (PB-091). */
  readonly onPreview?: (() => void) | undefined;
  /** Opens the publish dialog (PB-088). */
  readonly onPublish?: (() => void) | undefined;
  /** The session may publish (`adapter.getSession().canPublish`). */
  readonly canPublish?: boolean | undefined;
}

/**
 * The editor's primary actions (docs/editor.md#toolbar-pb-083): back to the CMS, the title, the
 * breakpoint switcher, undo and redo, the save status, preview and publish. It reads the store and
 * the persistence controller from context; the shortcuts show in the tooltips.
 */
export function Toolbar(props: ToolbarProps) {
  const t = useT();
  const store = useEditor();
  const canUndo = useEditorState((state) => state.canUndo);
  const canRedo = useEditorState((state) => state.canRedo);
  const readOnly = useEditorState((state) => state.readOnly);
  const status = usePersistenceState((state) => state.status);
  const undoHint = useShortcutHint('edit.undo');
  const redoHint = useShortcutHint('edit.redo');
  const { breakpoints, breakpoint } = props;

  return (
    <>
      <PanelToggle side="left" />
      {props.cmsUrl !== undefined && (
        <a className="bd-button bd-toolbar-link" href={props.cmsUrl}>
          <Icon name="arrow-left" /> {t('toolbar.back')}
        </a>
      )}
      <h1 className="bd-toolbar-title">{props.title}</h1>
      <fieldset className="bd-breakpoints" aria-label={t('toolbar.breakpoints')}>
        {breakpoints.map((item) => {
          const key = BREAKPOINT_LABELS[item.id];
          return (
            <Button
              key={item.id}
              variant={item.id === breakpoint ? 'primary' : 'ghost'}
              aria-pressed={item.id === breakpoint}
              title={`${item.width}px`}
              onClick={() => props.onBreakpointChange(item.id)}
            >
              {key === undefined ? item.id : t(key)}
            </Button>
          );
        })}
      </fieldset>
      <fieldset className="bd-toolbar-group" aria-label={t('toolbar.history')}>
        <IconButton
          label={t('shortcut.undo')}
          hint={undoHint}
          icon="undo-2"
          variant="ghost"
          disabled={!canUndo || readOnly}
          onClick={() => store.undo()}
        />
        <IconButton
          label={t('shortcut.redo')}
          hint={redoHint}
          icon="redo-2"
          variant="ghost"
          disabled={!canRedo || readOnly}
          onClick={() => store.redo()}
        />
      </fieldset>
      <span className="bd-toolbar-spacer" />
      <SaveStatus />
      {props.historyUrl !== undefined && (
        <a className="bd-button bd-toolbar-link" data-variant="ghost" href={props.historyUrl}>
          {t('toolbar.versions')}
        </a>
      )}
      <Button onClick={props.onPreview} disabled={props.onPreview === undefined}>
        {t('toolbar.preview')}
      </Button>
      <Button
        variant="primary"
        onClick={props.onPublish}
        disabled={
          props.onPublish === undefined ||
          props.canPublish === false ||
          readOnly ||
          status === 'conflict'
        }
      >
        {t('toolbar.publish')}
      </Button>
      <PanelToggle side="right" />
    </>
  );
}
