import type { BreakpointConfig } from '../app/config.ts';
import { useT } from '../messages/index.tsx';
import { useEditorState } from '../store/index.ts';
import { Button, Icon, Tooltip } from '../ui/index.ts';
import { BreakpointControl } from './breakpoint-control.tsx';
import { LocaleChip } from './locale-chip.tsx';
import { MoreMenu, type MoreMenuProps } from './more-menu.tsx';
import { PanelToggle } from './panel-toggles.tsx';
import { SaveIndicator } from './save-indicator.tsx';

export interface ToolbarRightProps {
  readonly breakpoints: readonly BreakpointConfig[];
  readonly breakpoint: string;
  readonly onBreakpointChange: (id: string) => void;
  readonly status: string;
  readonly onLocaleChange?: ((locale: string) => void) | undefined;
  readonly onPreview?: (() => void) | undefined;
  readonly onPublish?: (() => void) | undefined;
  readonly canPublish?: boolean | undefined;
  /** The save text is visually hidden (the row is tight). */
  readonly compactSave: boolean;
  /** The version history: an icon link in the row, or an item of the more menu when the row is tight. */
  readonly historyUrl?: string | undefined;
  readonly historyInMenu: boolean;
  /** The CMS link, when the row had no room for it; the more menu lists it. */
  readonly moreCmsUrl?: string | undefined;
  readonly sample?: MoreMenuProps['sample'];
  readonly helpUrl?: string | undefined;
  readonly onOpenShortcuts?: (() => void) | undefined;
}

/**
 * Screen size, save status, content language, version history, Preview, the more menu, the right
 * panel toggle and Publish (the one primary action).
 */
export function ToolbarRight(props: ToolbarRightProps) {
  const t = useT();
  const readOnly = useEditorState((state) => state.readOnly);
  return (
    <div className="bd-toolbar-cluster" data-zone="right">
      <BreakpointControl
        breakpoints={props.breakpoints}
        breakpoint={props.breakpoint}
        onChange={props.onBreakpointChange}
      />
      <span className="bd-toolbar-divider" aria-hidden="true" />
      <SaveIndicator compact={props.compactSave} />
      <LocaleChip onChange={props.onLocaleChange} />
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
      <Tooltip content={t('toolbar.preview.newTab')}>
        <Button
          variant="ghost"
          className="bd-icon-button"
          aria-label={t('toolbar.preview.page')}
          onClick={props.onPreview}
          disabled={props.onPreview === undefined}
        >
          <Icon name="eye" />
        </Button>
      </Tooltip>
      <MoreMenu
        historyUrl={props.historyInMenu ? props.historyUrl : undefined}
        cmsUrl={props.moreCmsUrl}
        sample={props.sample}
        helpUrl={props.helpUrl}
        onOpenShortcuts={props.onOpenShortcuts}
      />
      <PanelToggle side="right" />
      <Button
        variant="primary"
        className="bd-publish"
        aria-haspopup="dialog"
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
    </div>
  );
}
