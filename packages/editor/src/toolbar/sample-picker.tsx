import { useEffect, useState } from 'react';
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

/**
 * Chooses which entry a template is shown with (docs/editor.md#sample-data): the samples the adapter
 * lists, the choice sent to the canvas as its context and remembered per document. Renders nothing
 * when the adapter lists no samples (a page, not a template).
 */
export function SamplePicker({ adapter, docRef, onChange, storage }: SamplePickerProps) {
  const t = useT();
  const [samples, setSamples] = useState<readonly { id: string; label: string }[]>([]);
  const [value, setValue] = useState(DEFAULT_SAMPLE);
  const collection = docRef.collection;
  const id = docRef.id;

  // `onChange` is deliberately not a dependency: the host passes a fresh closure every render.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
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
        onChange(saved);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adapter, collection, id, storage]);

  if (samples.length === 0) return null;
  return (
    <Select
      label={t('sample.label')}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        write(storage, keyOf({ collection, id }), next);
        onChange(next === DEFAULT_SAMPLE ? null : next);
      }}
      options={[
        { value: DEFAULT_SAMPLE, label: t('sample.default') },
        ...samples.map((sample) => ({ value: sample.id, label: sample.label })),
      ]}
    />
  );
}
