import { useId, useState } from 'react';
import { ExternalSourceDialog } from '../../../dialogs/external-source.tsx';
import { normalizeExternalUrl } from '../../../dialogs/media-picker/media-ref.ts';
import { useT } from '../../../messages/index.tsx';
import { Button, Input } from '../../../ui/index.ts';

export interface ExternalLinkEntryProps {
  /** The accessible name of the prop the link is for. */
  readonly label: string;
  readonly disabled: boolean;
  /** Called with the checked address, after the author confirmed the warning. */
  readonly onAdd: (url: string) => void;
}

/**
 * A field for an address outside the site (ADR-028). The address is checked for feedback (HTTPS,
 * no credentials), then the "Zewnętrzne źródło" warning opens; the value is stored only when the
 * author confirms, and Cancel stores nothing.
 */
export function ExternalLinkEntry({ label, disabled, onAdd }: ExternalLinkEntryProps) {
  const t = useT();
  const id = useId();
  const [text, setText] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const submit = () => {
    const url = normalizeExternalUrl(text);
    setInvalid(url === undefined);
    if (url !== undefined) setPending(url);
  };

  return (
    <div className="bd-external-entry">
      <div className="bd-external-row">
        <Input
          type="url"
          value={text}
          disabled={disabled}
          placeholder={t('media.external.placeholder')}
          aria-label={`${label}: ${t('media.external.label')}`}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-error` : undefined}
          onChange={(event) => {
            setText(event.target.value);
            setInvalid(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submit();
            }
          }}
        />
        <Button
          disabled={disabled || text.trim() === ''}
          aria-label={`${label}: ${t('media.external.add')}`}
          onClick={submit}
        >
          {t('media.external.add')}
        </Button>
      </div>
      {invalid ? (
        <p role="alert" id={`${id}-error`} className="bd-media-error">
          {t('media.external.invalid')}
        </p>
      ) : null}
      <ExternalSourceDialog
        url={pending}
        onCancel={() => setPending(null)}
        onConfirm={(url) => {
          setPending(null);
          setText('');
          onAdd(url);
        }}
      />
    </div>
  );
}

export interface ExternalUrlControlProps {
  readonly id: string;
  readonly label: string;
  readonly describedBy: string | undefined;
  readonly value: unknown;
  readonly disabled: boolean;
  readonly onChange: (value: unknown) => void;
}

/** A text prop that is always an external address (the iframe's `url`): shows it, removes it, adds one after the warning. */
export function ExternalUrlControl({
  id,
  label,
  describedBy,
  value,
  disabled,
  onChange,
}: ExternalUrlControlProps) {
  const t = useT();
  const current = typeof value === 'string' && value !== '' ? value : undefined;
  return (
    <div className="bd-media-control" id={id} aria-describedby={describedBy}>
      {current !== undefined ? (
        <div className="bd-media-preview">
          <span className="bd-media-badge">{t('media.external.badge')}</span>
          <span className="bd-media-name" title={current}>
            {current}
          </span>
        </div>
      ) : (
        <p className="bd-field-hint">{t('media.none')}</p>
      )}
      {current !== undefined ? (
        <div className="bd-media-actions">
          <Button
            variant="ghost"
            disabled={disabled}
            aria-label={`${label}: ${t('media.remove')}`}
            onClick={() => onChange('')}
          >
            {t('media.remove')}
          </Button>
        </div>
      ) : null}
      <ExternalLinkEntry label={label} disabled={disabled} onAdd={(url) => onChange(url)} />
    </div>
  );
}
