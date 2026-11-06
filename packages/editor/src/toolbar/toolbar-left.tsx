import { useT } from '../messages/index.tsx';
import { useShortcutHint } from '../shortcuts/index.ts';
import { useEditor, useEditorState } from '../store/index.ts';
import { Icon, IconButton, Tooltip } from '../ui/index.ts';
import { Brand } from './brand.tsx';
import { PanelToggle } from './panel-toggles.tsx';

export interface ToolbarLeftProps {
  /** The page in the CMS's admin; the link is left out without it, or when it moved to the more menu. */
  readonly cmsUrl?: string | undefined;
  /** A phone-wide row: only the panel toggle, undo and redo stay (the mark and the back link are left out). */
  readonly compact?: boolean;
}

/** Back to the CMS, the product mark, a divider, the left panel toggle, undo and redo. */
export function ToolbarLeft({ cmsUrl, compact = false }: ToolbarLeftProps) {
  const t = useT();
  const store = useEditor();
  const canUndo = useEditorState((state) => state.canUndo);
  const canRedo = useEditorState((state) => state.canRedo);
  const readOnly = useEditorState((state) => state.readOnly);
  const undoHint = useShortcutHint('edit.undo');
  const redoHint = useShortcutHint('edit.redo');
  return (
    <div className="bd-toolbar-cluster" data-zone="left">
      {cmsUrl !== undefined && !compact && (
        <Tooltip content={t('toolbar.backToCms')}>
          <a
            className="bd-button bd-icon-button bd-toolbar-link"
            data-variant="ghost"
            href={cmsUrl}
            aria-label={t('toolbar.backToCms')}
          >
            <Icon name="arrow-left" />
          </a>
        </Tooltip>
      )}
      {!compact && (
        <>
          <Brand />
          <span className="bd-toolbar-divider" aria-hidden="true" />
        </>
      )}
      <PanelToggle side="left" />
      <IconButton
        label={t('toolbar.undo')}
        hint={undoHint}
        icon="undo-2"
        variant="ghost"
        disabled={!canUndo || readOnly}
        onClick={() => store.undo()}
      />
      <IconButton
        label={t('toolbar.redo')}
        hint={redoHint}
        icon="redo-2"
        variant="ghost"
        disabled={!canRedo || readOnly}
        onClick={() => store.redo()}
      />
    </div>
  );
}
