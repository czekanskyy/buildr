import type { ReactNode } from 'react';
import { useT } from '../messages/index.tsx';
import { useShortcutHint } from '../shortcuts/index.ts';
import { useEditor, useEditorState } from '../store/index.ts';
import { Button, Icon, IconButton, Tooltip } from '../ui/index.ts';
import { MoreMenu } from './more-menu.tsx';
import { SaveIndicator } from './save-indicator.tsx';

export interface ToolbarRightProps {
  /** The locale and sample pickers (the shell's), placed between the save status and Preview. */
  readonly pickers?: ReactNode;
  readonly status: string;
  readonly onPreview?: (() => void) | undefined;
  readonly onPublish?: (() => void) | undefined;
  readonly canPublish?: boolean | undefined;
  /** The save text is visually hidden (the row is tight). */
  readonly compactSave: boolean;
  /** The version history: a link in the row, or an item of the more menu when the row is tight. */
  readonly historyUrl?: string | undefined;
  readonly historyInMenu: boolean;
  /** The CMS link, when the row had no room for it; the more menu lists it. */
  readonly moreCmsUrl?: string | undefined;
}

/** Undo and redo, the save status, the pickers, Preview (secondary), Publish (the one primary) and more. */
export function ToolbarRight(props: ToolbarRightProps) {
  const t = useT();
  const store = useEditor();
  const canUndo = useEditorState((state) => state.canUndo);
  const canRedo = useEditorState((state) => state.canRedo);
  const readOnly = useEditorState((state) => state.readOnly);
  const undoHint = useShortcutHint('edit.undo');
  const redoHint = useShortcutHint('edit.redo');

  return (
    <div className="bd-toolbar-zone" data-zone="right">
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
      <SaveIndicator compact={props.compactSave} />
      {props.pickers}
      {props.historyUrl !== undefined && !props.historyInMenu && (
        <Tooltip content={t('toolbar.versions')}>
          <a
            className="bd-button bd-icon-button bd-toolbar-link"
            data-variant="ghost"
            href={props.historyUrl}
            aria-label={t('toolbar.versions')}
          >
            <Icon name="history" />
          </a>
        </Tooltip>
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
          props.status === 'conflict'
        }
      >
        {t('toolbar.publish')}
      </Button>
      <MoreMenu
        historyUrl={props.historyInMenu ? props.historyUrl : undefined}
        cmsUrl={props.moreCmsUrl}
      />
    </div>
  );
}
