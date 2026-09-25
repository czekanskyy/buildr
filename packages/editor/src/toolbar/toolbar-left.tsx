import { type MessageKey, useT } from '../messages/index.tsx';
import { Icon, Tooltip } from '../ui/index.ts';

export interface ToolbarLeftProps {
  readonly title: string;
  /** Draft or published; the pill is left out without it. */
  readonly status?: 'draft' | 'published' | undefined;
  /** The page in the CMS's admin; the link is left out without it, or when it moved to the more menu. */
  readonly cmsUrl?: string | undefined;
}

const STATUS_LABELS: Readonly<Record<'draft' | 'published', MessageKey>> = {
  draft: 'toolbar.status.draft',
  published: 'toolbar.status.published',
};

/** Back to the CMS as an icon button, the document title and its draft or published pill. */
export function ToolbarLeft({ title, status, cmsUrl }: ToolbarLeftProps) {
  const t = useT();
  return (
    <div className="bd-toolbar-zone" data-zone="left">
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
      <h1 className="bd-toolbar-title" title={title}>
        {title}
      </h1>
      {status !== undefined && (
        <span className="bd-status-pill" data-status={status}>
          {t(STATUS_LABELS[status])}
        </span>
      )}
    </div>
  );
}
