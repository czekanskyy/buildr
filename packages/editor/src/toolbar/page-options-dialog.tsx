import { useId } from 'react';
import { useT } from '../messages/index.tsx';
import { Button, Dialog } from '../ui/index.ts';
import { EditableTitle } from './editable-title.tsx';
import { SampleSelect, type SamplesState } from './sample-picker.tsx';

export interface PageOptionsDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  /** Saves a new page name (`adapter.rename`); the name is read-only without it. */
  readonly onRename?: ((title: string) => Promise<void>) | undefined;
  /** The page's address; the row is left out without it. Never editable here. */
  readonly slug?: string | undefined;
  readonly readOnly?: boolean;
  /** The sample entry choice (templates only). */
  readonly samples?: SamplesState | undefined;
}

/** The page options: name (renamed through the adapter), read-only address and the sample data. */
export function PageOptionsDialog({
  open,
  onOpenChange,
  title,
  onRename,
  slug,
  readOnly,
  samples,
}: PageOptionsDialogProps) {
  const t = useT();
  const nameId = useId();
  const addressId = useId();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      icon="file-text"
      title={t('dialog.pageOptions.title')}
      description={t('dialog.pageOptions.description')}
      footer={
        <Button variant="primary" onClick={() => onOpenChange(false)}>
          {t('dialog.pageOptions.done')}
        </Button>
      }
    >
      <div className="bd-page-options">
        <div className="bd-page-options-field">
          <label htmlFor={nameId}>{t('dialog.pageOptions.name')}</label>
          {onRename === undefined ? (
            <input id={nameId} className="bd-input" value={title} readOnly />
          ) : (
            <EditableTitle
              title={title}
              onRename={onRename}
              disabled={readOnly === true}
              variant="field"
              id={nameId}
            />
          )}
        </div>
        {slug !== undefined && (
          <div className="bd-page-options-field">
            <label htmlFor={addressId}>{t('dialog.pageOptions.address')}</label>
            <input id={addressId} className="bd-input" value={slug} readOnly />
          </div>
        )}
        {samples !== undefined && samples.samples.length > 0 && (
          <div className="bd-page-options-field">
            <span>{t('dialog.pageOptions.sampleData')}</span>
            <SampleSelect state={samples} />
          </div>
        )}
      </div>
    </Dialog>
  );
}
