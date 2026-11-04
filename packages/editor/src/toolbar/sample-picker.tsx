import { useEffect, useRef, useState } from 'react';
import { useT } from '../messages/index.tsx';
import type { DocumentAdapter, DocumentRef } from '../persistence/index.ts';
import { Select } from '../ui/index.ts';

/** The choice that leaves the canvas on the adapter's own default entry. */
export const DEFAULT_SAMPLE = '__default__';

export interface SamplePickerProps {
  readonly adapter: Pick<DocumentAdapter, 'listSamples'>;
  readonly docRef: DocumentRef;
  /** Tells the canvas which entry to render with (`CanvasHost.setContextRef`). */
  readonly onChange: (contextRef: string | null) => void;
  /** Where the choice is remembered; `localStorage` unless a test or host gives another. */
  readonly storage?: Pick<Storage, 'getItem' | 'setItem'> | undefined;
}

const keyOf = (ref: DocumentRef) => `buildr:sample:${ref.collection}:${ref.id}`;

const read = (storage: SamplePickerProps['storage'], key: string): string | null => {
  try {
    return (storage ?? globalThis.localStorage).getItem(key);
  } catch {
    return null;
  }
};
const write = (storage: SamplePickerProps['storage'], key: string, value: string) => {
  try {
    (storage ?? globalThis.localStorage).setItem(key, value);
  } catch {
    // Private windows and blocked storage: the choice just is not remembered.
  }
};

export interface SamplesState {
  readonly samples: readonly { id: string; label: string }[];
  /** The chosen sample id, or DEFAULT_SAMPLE. */
  readonly value: string;
  /** The chosen entry's label; undefined while the default entry is in use. */
  readonly label: string | undefined;
  select(next: string): void;
}

/**
 * The samples the adapter lists for a document and the remembered choice (docs/editor.md#sample-data):
 * the choice is sent to the canvas as its context and remembered per document. Does nothing without
 * props; samples stays empty when the adapter lists none (a page, not a template).
 */
export function useSamples(props: SamplePickerProps | undefined): SamplesState {
  const [samples, setSamples] = useState<readonly { id: string; label: string }[]>([]);
  const [value, setValue] = useState(DEFAULT_SAMPLE);
  const adapter = props?.adapter;
  const storage = props?.storage;
  const collection = props?.docRef.collection;
  const id = props?.docRef.id;
  // The latest callback, so a fresh closure every render does not restart the effect.
  const onChange = useRef(props?.onChange);
  onChange.current = props?.onChange;

  useEffect(() => {
    if (adapter === undefined || collection === undefined || id === undefined) return;
    let cancelled = false;
    const ref = { collection, id };
    void (async () => {
      let list: readonly { id: string; label: string }[] = [];
      try {
        list = (await adapter.listSamples?.(ref)) ?? [];
      } catch {
        list = [];
      }
      if (cancelled) return;
      setSamples(list);
      const saved = read(storage, keyOf(ref));
      // A remembered entry that no longer exists is forgotten, not sent to the canvas.
      if (saved !== null && list.some((sample) => sample.id === saved)) {
        setValue(saved);
        onChange.current?.(saved);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adapter, collection, id, storage]);

  const select = (next: string) => {
    if (collection === undefined || id === undefined) return;
    setValue(next);
    write(storage, keyOf({ collection, id }), next);
    onChange.current?.(next === DEFAULT_SAMPLE ? null : next);
  };
  return {
    samples,
    value,
    label: samples.find((sample) => sample.id === value)?.label,
    select,
  };
}

/** The select that chooses the sample entry, for a useSamples state; nothing when there are none. */
export function SampleSelect({ state }: { readonly state: SamplesState }) {
  const t = useT();
  if (state.samples.length === 0) return null;
  return (
    <Select
      label={t('sample.label')}
      value={state.value}
      onValueChange={state.select}
      options={[
        { value: DEFAULT_SAMPLE, label: t('sample.default') },
        ...state.samples.map((sample) => ({ value: sample.id, label: sample.label })),
      ]}
    />
  );
}

/**
 * Chooses which entry a template is shown with (docs/editor.md#sample-data). Renders nothing when the
 * adapter lists no samples.
 */
export function SamplePicker(props: SamplePickerProps) {
  return <SampleSelect state={useSamples(props)} />;
}
