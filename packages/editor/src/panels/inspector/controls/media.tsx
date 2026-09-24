import type { MediaPropDef } from '@buildr/core';
import { useState } from 'react';
import {
  MediaPicker,
  parseMediaRef,
  toMediaRef,
  useMediaLibrary,
} from '../../../dialogs/media-picker/index.ts';
import { useT } from '../../../messages/index.tsx';
import { Button } from '../../../ui/index.ts';
import type { ControlProps } from './types.ts';

/**
 * A media prop: the picked file's thumbnail and alternative text, and buttons to choose, replace or
 * remove it. Choosing opens the media picker; what is stored is a `MediaRef` with a snapshot. To bind
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
  const snapshot = ref?.snapshot;

  return (
    <div className="bd-media-control" id={id} aria-describedby={describedBy}>
      {ref !== undefined ? (
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
          aria-label={`${label}: ${t(ref === undefined ? 'media.choose' : 'media.replace')}`}
          onClick={() => setOpen(true)}
        >
          {t(ref === undefined ? 'media.choose' : 'media.replace')}
        </Button>
        {ref !== undefined ? (
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
      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        accept={def.accept}
        onPick={(asset) => {
          if (library !== undefined) onChange(toMediaRef(asset, library.collection));
        }}
      />
    </div>
  );
}
