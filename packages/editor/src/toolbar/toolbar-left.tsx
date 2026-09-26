import { type MessageKey, useT } from '../messages/index.tsx';
import { useEditorState } from '../store/index.ts';
import { Icon, Tooltip } from '../ui/index.ts';
import { Brand } from './brand.tsx';
import { EditableTitle } from './editable-title.tsx';

export interface ToolbarLeftProps {
  readonly title: string;
  /** Saves a new page name; without it (the backend cannot rename) the title is plain text. */
  readonly onRename?: ((title: string) => Promise<void>) | undefined;
  /** Draft or published; the pill is left out without it. */
  readonly status?: 'draft' | 'published' | undefined;
  /** The page in the CMS's admin; the link is left out without it, or when it moved to the more menu. */
  readonly cmsUrl?: string | undefined;
}

const STATUS_LABELS: Readonly<Record<'draft' | 'published', MessageKey>> = {
  draft: 'toolbar.status.draft',
  published: 'toolbar.status.published',
};

/** The product mark, back to the CMS as an icon button, the page name and its draft or published pill. */
export function ToolbarLeft({ title, onRename, status, cmsUrl }: ToolbarLeftProps) {
  const t = useT();
  const readOnly = useEditorState((state) => state.readOnly);
  return (
    <div className="bd-toolbar-zone" data-zone="left">
      <Brand />
      {cmsUrl !== undefined && (
        <Tooltip content={t('toolbar.back')}>
          <a
            className="bd-button bd-icon-button bd-toolbar-link"
            data-variant="ghost"
            href={cmsUrl}
            aria-label={t('toolbar.back')}
          >
            <Icon name="arrow-left" />
          </a>
        </Tooltip>
      )}
      {onRename === undefined ? (
        <h1 className="bd-toolbar-title" title={title}>
          {title}
        </h1>
      ) : (
        <h1 className="bd-toolbar-heading">
          <EditableTitle title={title} onRename={onRename} disabled={readOnly} />
        </h1>
      )}
      {status !== undefined && (
        <span className="bd-status-pill" data-status={status}>
          {t(STATUS_LABELS[status])}
        </span>
      )}
    </div>
  );
}
