import type { MediaAsset } from '@next-buildr/core';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { type MessageKey, useT } from '../../messages/index.tsx';
import { ExternalLinkEntry } from '../../panels/inspector/controls/external-link.tsx';
import {
  Button,
  Dialog,
  Icon,
  Input,
  SearchField,
  SegmentedControl,
  Select,
} from '../../ui/index.ts';
import { useMediaLibrary } from './library.tsx';
import { kindsFor, type MediaKind, mimeTypesFor } from './media-ref.ts';

export interface MediaPickerProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Called with the entry the author chose (or just uploaded). */
  readonly onPick: (asset: MediaAsset) => void;
  /**
   * Called with an address outside the library, after the author confirmed the ADR-028 warning.
   * Giving it adds the "From address" source; without it the picker is library-only.
   */
  readonly onPickExternal?: ((url: string) => void) | undefined;
  /** The prop's `accept`; narrows the kinds offered. */
  readonly accept?: readonly string[] | undefined;
  /** How long after typing the search runs; `0` searches at once. */
  readonly searchDelayMs?: number | undefined;
}

const KIND_KEY: Record<MediaKind, MessageKey> = {
  all: 'media.kind.all',
  image: 'media.kind.image',
  video: 'media.kind.video',
  document: 'media.kind.document',
};

type Source = 'library' | 'upload' | 'url';

type Load =
  | { readonly state: 'loading' }
  | { readonly state: 'error' }
  | { readonly state: 'ready'; readonly items: readonly MediaAsset[]; readonly next?: string };

/**
 * The media picker (docs/editor.md#media): a searchable, filterable grid of the library, paged with
 * "Load more", plus an upload that will not go without alternative text. Every part is a native
 * control, so it is operable with Tab, Enter and Space alone; the dialog traps focus and Escape closes it.
 */
export function MediaPicker(props: MediaPickerProps) {
  const { open, onOpenChange, onPick, onPickExternal, accept, searchDelayMs = 250 } = props;
  const t = useT();
  const library = useMediaLibrary();
  const kinds = kindsFor(accept);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<MediaKind>(kinds[0] ?? 'all');
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [more, setMore] = useState(false);
  const [source, setSource] = useState<Source>('library');
  const [chosen, setChosen] = useState<MediaAsset | undefined>();
  const [alt, setAlt] = useState('');
  const altId = useId();
  // A reply that arrives after a newer search was made must not replace it.
  const request = useRef(0);

  const run = useCallback(
    async (cursor: string | undefined, previous: readonly MediaAsset[]) => {
      if (library === undefined) return;
      const mine = ++request.current;
      if (cursor === undefined) setLoad({ state: 'loading' });
      else setMore(true);
      try {
        const mimeTypes = mimeTypesFor(kind);
        const result = await library.media.search({
          ...(text.trim() !== '' ? { text: text.trim() } : {}),
          ...(cursor !== undefined ? { cursor } : {}),
          ...(mimeTypes !== undefined ? { mimeTypes } : {}),
        });
        if (mine !== request.current) return;
        setLoad({
          state: 'ready',
          items: [...previous, ...result.items],
          ...(result.nextCursor !== undefined ? { next: result.nextCursor } : {}),
        });
      } catch {
        if (mine === request.current) setLoad({ state: 'error' });
      } finally {
        if (mine === request.current) setMore(false);
      }
    },
    [library, kind, text],
  );

  useEffect(() => {
    if (!open || library === undefined) return;
    // Opening, changing the kind and clearing the search load at once; only typing waits for a pause.
    const timer = setTimeout(() => void run(undefined, []), text === '' ? 0 : searchDelayMs);
    return () => clearTimeout(timer);
  }, [open, library, run, searchDelayMs, text]);

  useEffect(() => {
    if (open) {
      setChosen(undefined);
      setSource('library');
    }
  }, [open]);

  const choose = (asset: MediaAsset) => {
    setChosen(asset);
    setAlt(asset.alt ?? '');
  };

  const pick = (asset: MediaAsset) => {
    onPick(asset);
    onOpenChange(false);
  };

  // The alternative text can be adjusted here; an unchanged one hands over the library entry as it is.
  const insert = () => {
    if (chosen === undefined) return;
    const edited = alt.trim();
    pick(edited !== (chosen.alt ?? '') ? { ...chosen, alt: edited } : chosen);
  };

  const upload = library?.media.upload;
  const sources: { value: Source; label: string }[] = [
    { value: 'library', label: t('media.tab.library') },
    ...(upload !== undefined ? [{ value: 'upload' as const, label: t('media.tab.upload') }] : []),
    ...(onPickExternal !== undefined ? [{ value: 'url' as const, label: t('media.tab.url') }] : []),
  ];
  const preview = chosen;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      icon="image"
      title={t('media.picker.title')}
      description={t('media.picker.description')}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{t('dialog.cancel')}</Button>
          <Button
            variant="primary"
            disabled={source !== 'library' || chosen === undefined}
            onClick={insert}
          >
            {t('media.insertImage')}
          </Button>
        </>
      }
    >
      {library === undefined ? (
        <p className="bd-field-hint">{t('media.unavailable')}</p>
      ) : (
        <div className="bd-media-picker">
          <div className="bd-media-main">
            {sources.length > 1 ? (
              <SegmentedControl
                label={t('media.source')}
                value={source}
                onValueChange={(next) => setSource(next as Source)}
                options={sources}
              />
            ) : null}
            {source === 'upload' && upload !== undefined ? (
              <UploadForm upload={upload} onUploaded={pick} kinds={kinds} />
            ) : null}
            {source === 'url' && onPickExternal !== undefined ? (
              <div className="bd-media-url">
                <p className="bd-field-hint">{t('media.external.or')}</p>
                <ExternalLinkEntry
                  label={t('media.picker.title')}
                  disabled={false}
                  onAdd={(url) => {
                    onPickExternal(url);
                    onOpenChange(false);
                  }}
                />
              </div>
            ) : null}
            <div className="bd-media-tools" hidden={source !== 'library'}>
              <SearchField
                className="bd-media-search"
                value={text}
                onChange={setText}
                label={t('media.search')}
                clearLabel={t('blocks.search.clear')}
                placeholder={t('media.search')}
              />
              {kinds.length > 1 ? (
                <Select
                  label={t('media.kind')}
                  value={kind}
                  onValueChange={(next) => setKind(next as MediaKind)}
                  options={kinds.map((entry) => ({ value: entry, label: t(KIND_KEY[entry]) }))}
                />
              ) : null}
            </div>
            {source === 'library' && load.state === 'loading' ? (
              <p role="status" className="bd-field-hint">
                {t('media.loading')}
              </p>
            ) : null}
            {source === 'library' && load.state === 'error' ? (
              <p role="alert" className="bd-media-error">
                {t('media.error')}{' '}
                <Button variant="ghost" onClick={() => void run(undefined, [])}>
                  {t('media.retry')}
                </Button>
              </p>
            ) : null}
            {source === 'library' && load.state === 'ready' && load.items.length === 0 ? (
              <p className="bd-field-hint">{t('media.empty')}</p>
            ) : null}
            {source === 'library' && load.state === 'ready' ? (
              <ul className="bd-media-grid" aria-label={t('media.library.images')}>
                {load.items.map((asset) => (
                  <li key={asset.id}>
                    <button
                      type="button"
                      className="bd-media-item"
                      aria-pressed={chosen?.id === asset.id}
                      onClick={() => choose(asset)}
                    >
                      {asset.mimeType.startsWith('image/') ? (
                        <img src={asset.url} alt="" loading="lazy" />
                      ) : (
                        <span className="bd-media-file">{asset.mimeType}</span>
                      )}
                      <span className="bd-media-name">{asset.alt ?? asset.id}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {source === 'library' && load.state === 'ready' && load.next !== undefined ? (
              <Button disabled={more} onClick={() => void run(load.next, load.items)}>
                {t('media.more')}
              </Button>
            ) : null}
          </div>
          <aside
            className="bd-media-side"
            aria-label={t('media.picker.title')}
            hidden={source !== 'library'}
          >
            {preview === undefined ? (
              <div className="bd-media-preview-frame" data-empty="true">
                <Icon name="image" size="md" />
                <p className="bd-field-hint">{t('media.none')}</p>
              </div>
            ) : (
              <>
                <div className="bd-media-preview-frame">
                  {preview.mimeType.startsWith('image/') ? (
                    <img src={preview.url} alt="" />
                  ) : (
                    <Icon name="file" size="md" />
                  )}
                </div>
                <div className="bd-media-meta">
                  <b className="bd-media-meta-name">{preview.alt ?? preview.id}</b>
                  <small>
                    {preview.width !== undefined && preview.height !== undefined
                      ? `${preview.width} x ${preview.height} · `
                      : ''}
                    {preview.mimeType}
                  </small>
                </div>
                <div className="bd-media-alt">
                  <label className="bd-media-alt-label" htmlFor={altId}>
                    {t('media.upload.alt')}
                  </label>
                  <Input
                    id={altId}
                    type="text"
                    value={alt}
                    onChange={(event) => setAlt(event.target.value)}
                  />
                </div>
                <p className="bd-field-hint">{t('media.altHelp')}</p>
              </>
            )}
          </aside>
        </div>
      )}
    </Dialog>
  );
}

/** Whether a file type matches one of the patterns (such as "image/*", or an exact type). */
function fitsMime(type: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) =>
    pattern.endsWith('/*') ? type.startsWith(pattern.slice(0, -1)) : type === pattern,
  );
}

/** Uploads a file. The alternative text is required: an image without one is an accessibility error. */
function UploadForm(props: {
  readonly upload: (file: File, alt: string) => Promise<MediaAsset>;
  readonly onUploaded: (asset: MediaAsset) => void;
  readonly kinds: readonly MediaKind[];
}) {
  const t = useT();
  const id = useId();
  const [file, setFile] = useState<File | undefined>();
  const [alt, setAlt] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [over, setOver] = useState(false);
  const [rejected, setRejected] = useState(false);
  // The MIME patterns the prop allows; undefined when any file will do.
  const allowed = props.kinds.includes('all')
    ? undefined
    : props.kinds.flatMap((k) => mimeTypesFor(k) ?? []);
  const choose = (chosen: File | undefined) => {
    if (chosen !== undefined && allowed !== undefined && !fitsMime(chosen.type, allowed)) {
      setFile(undefined);
      setRejected(true);
      return;
    }
    setRejected(false);
    setFile(chosen);
  };
  const ready = file !== undefined && alt.trim() !== '' && !busy;

  const submit = async () => {
    if (file === undefined || alt.trim() === '') return;
    setBusy(true);
    setFailed(false);
    try {
      props.onUploaded(await props.upload(file, alt.trim()));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <fieldset className="bd-media-upload">
      <legend>{t('media.upload')}</legend>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the drop zone only helps the mouse; the file field inside is the keyboard way in */}
      <div
        className="bd-media-drop"
        data-over={over || undefined}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          const dropped = event.dataTransfer.files[0];
          if (dropped !== undefined) choose(dropped);
        }}
      >
        <Icon name="image" size="md" />
        <span>{t('media.drop')}</span>
        <Input
          id={`${id}-file`}
          type="file"
          aria-label={t('media.upload.file')}
          {...(allowed !== undefined ? { accept: allowed.join(',') } : {})}
          onChange={(event) => choose(event.target.files?.[0])}
        />
        {file !== undefined ? <small className="bd-media-drop-file">{file.name}</small> : null}
      </div>
      <Input
        id={`${id}-alt`}
        type="text"
        required
        aria-label={t('media.upload.alt')}
        placeholder={t('media.upload.alt')}
        aria-invalid={file !== undefined && alt.trim() === ''}
        value={alt}
        onChange={(event) => setAlt(event.target.value)}
      />
      <Button variant="primary" disabled={!ready} onClick={() => void submit()}>
        {busy ? t('media.upload.busy') : t('media.upload.submit')}
      </Button>
      {rejected ? (
        <p role="alert" className="bd-media-error">
          {t('media.upload.wrongType')}
        </p>
      ) : null}
      {failed ? (
        <p role="alert" className="bd-media-error">
          {t('media.upload.failed')}
        </p>
      ) : null}
    </fieldset>
  );
}
