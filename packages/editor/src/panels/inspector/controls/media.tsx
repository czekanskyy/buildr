import type { MediaPropDef } from '@next-buildr/core';
import { useState } from 'react';
import {
  MediaPicker,
  parseExternalMedia,
  parseMediaRef,
  toMediaRef,
  useMediaLibrary,
} from '../../../dialogs/media-picker/index.ts';
import { useT } from '../../../messages/index.tsx';
import { Button } from '../../../ui/index.ts';
import { ExternalLinkEntry } from './external-link.tsx';
import type { ControlProps } from './types.ts';

/**
 * A media prop: the picked file's thumbnail and alternative text, and buttons to choose, replace or
 * remove it. Choosing opens the media picker; what is stored is a `MediaRef` with a snapshot. A link to a
 * file outside the library is stored as `{ external: true, url }`, only after the ADR-028 warning
 * was confirmed. To bind
 * the prop to a data field instead, use the Data mode of the value switch.
 */
export function MediaControl({
  id,
  def,
  label,
  describedBy,
  value,
  disabled,
  onChange,
}: ControlProps<MediaPropDef>) {
  const t = useT();
  const library = useMediaLibrary();
  const [open, setOpen] = useState(false);
  const ref = parseMediaRef(value);
  const external = parseExternalMedia(value);
  const chosen = ref !== undefined || external !== undefined;
  const snapshot = ref?.snapshot;

  return (
    <div className="bd-media-control" id={id} aria-describedby={describedBy}>
      {external !== undefined ? (
        <div className="bd-media-preview">
          <span className="bd-media-badge">{t('media.external.badge')}</span>
          <span className="bd-media-name" title={external.url}>
            {external.url}
          </span>
        </div>
      ) : ref !== undefined ? (
        <div className="bd-media-preview">
          {snapshot !== undefined && (snapshot.mimeType ?? 'image/').startsWith('image/') ? (
            <img src={snapshot.url} alt={snapshot.alt ?? ''} width={64} height={64} />
          ) : (
            <span className="bd-media-file">{snapshot?.mimeType ?? ref.id}</span>
          )}
          <span className="bd-media-name">{snapshot?.alt ?? ref.id}</span>
        </div>
      ) : (
        <p className="bd-field-hint">{t('media.none')}</p>
      )}
      <div className="bd-media-actions">
        <Button
          disabled={disabled || library === undefined}
          aria-label={`${label}: ${t(chosen ? 'media.replace' : 'media.choose')}`}
          onClick={() => setOpen(true)}
        >
          {t(chosen ? 'media.replace' : 'media.choose')}
        </Button>
        {chosen ? (
          <Button
            variant="ghost"
            disabled={disabled}
            aria-label={`${label}: ${t('media.remove')}`}
            onClick={() => onChange(null)}
          >
            {t('media.remove')}
          </Button>
        ) : null}
      </div>
      {library === undefined ? <p className="bd-field-hint">{t('media.unavailable')}</p> : null}
      <p className="bd-field-hint">{t('media.external.or')}</p>
      <ExternalLinkEntry
        label={label}
        disabled={disabled}
        onAdd={(url) => onChange({ external: true, url })}
      />
      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        accept={def.accept}
        onPickExternal={(url) => onChange({ external: true, url })}
        onPick={(asset) => {
          if (library !== undefined) onChange(toMediaRef(asset, library.collection));
        }}
      />
    </div>
  );
}
