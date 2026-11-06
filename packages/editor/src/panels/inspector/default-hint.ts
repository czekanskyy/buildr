import type { PropDef } from '@next-buildr/core';
import type { MessageKey } from '../../messages/index.tsx';

type Translate = (key: MessageKey) => string;

/**
 * The default of a prop as text for the hint under its control, or `undefined` when there is
 * nothing meaningful to show (an empty text, a list, an object). Never raw `null`, `undefined`,
 * `true`, `false` or JSON.
 */
export function formatDefault(
  def: PropDef,
  t: Translate,
  /** The component's label when the default text is the component's own English name. */
  nameFor: (text: string) => string = (text) => text,
): string | undefined {
  const value: unknown = def.default;
  if (def.kind === 'list' || def.kind === 'object' || def.kind === 'richText') return undefined;
  if (def.kind === 'listSource') return undefined;
  if (value === null || value === undefined) {
    return t(def.kind === 'media' ? 'inspector.default.noFile' : 'inspector.default.none');
  }
  if (def.kind === 'media') return undefined;
  if (typeof value === 'boolean') {
    return t(value ? 'inspector.default.yes' : 'inspector.default.no');
  }
  if (def.kind === 'select') {
    return def.optionLabels?.[String(value)] ?? String(value);
  }
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : undefined;
  if (typeof value === 'string') return value === '' ? undefined : nameFor(value);
  return undefined;
}
