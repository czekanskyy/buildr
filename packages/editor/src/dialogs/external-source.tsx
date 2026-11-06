import { useT } from '../messages/index.tsx';
import { Button, Dialog } from '../ui/index.ts';

export interface ExternalSourceDialogProps {
  /** The address waiting for confirmation; `null` keeps the dialog closed. */
  readonly url: string | null;
  /** The author understood the risks and wants the link stored. */
  readonly onConfirm: (url: string) => void;
  /** Cancelled or dismissed: nothing is stored. */
  readonly onCancel: () => void;
}

/**
 * The warning shown before an external address is stored (ADR-028): the file comes from outside the
 * site domain, so the author must have the rights, and it may track visitors or disappear. Only the
 * explicit confirmation adds the link; Cancel, Escape and the close button leave the value alone.
 */
export function ExternalSourceDialog({ url, onConfirm, onCancel }: ExternalSourceDialogProps) {
  const t = useT();
  return (
    <Dialog
      open={url !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      alert
      tone="warning"
      icon="triangle-alert"
      title={t('media.external.title')}
      description={t('media.external.description')}
      footer={
        <>
          <Button onClick={onCancel}>{t('media.external.cancel')}</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (url !== null) onConfirm(url);
            }}
          >
            {t('media.external.confirm')}
          </Button>
        </>
      }
    >
      {url !== null ? <p className="bd-external-url">{url}</p> : null}
    </Dialog>
  );
}
