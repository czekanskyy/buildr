import { type MessageKey, useT } from '../messages/index.tsx';
import { Button, Icon, Tooltip } from '../ui/index.ts';

const STATUS_LABELS: Readonly<Record<'draft' | 'published', MessageKey>> = {
  draft: 'toolbar.status.draft',
  published: 'toolbar.status.published',
};

export interface PageChipProps {
  readonly title: string;
  /** Draft or published; the small chip is left out without it. */
  readonly status?: 'draft' | 'published' | undefined;
  readonly open: boolean;
  readonly onOpen: () => void;
}

/** The page in the middle of the toolbar: icon, name, status chip and chevron; it opens the page options. */
export function PageChip({ title, status, open, onOpen }: PageChipProps) {
  const t = useT();
  return (
    <Tooltip content={t('toolbar.pageOptions.hint')}>
      <Button
        className="bd-page-chip"
        aria-label={t('toolbar.pageOptions.named').replace('{name}', title)}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={onOpen}
      >
        <Icon name="file-text" />
        <span className="bd-page-chip-title">{title}</span>
        {status !== undefined && (
          <span className="bd-page-chip-status" data-status={status}>
            {t(STATUS_LABELS[status])}
          </span>
        )}
        <Icon name="chevron-down" />
      </Button>
    </Tooltip>
  );
}
