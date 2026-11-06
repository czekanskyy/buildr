import type { StylePropertyDef } from '@next-buildr/core';
import type { MessageKey, Translate } from '../../../messages/index.tsx';

export const propertyLabel = (def: StylePropertyDef, t: Translate): string =>
  t(`style.property.${def.group}.${def.name}` as MessageKey);

/** The label text with the first match of the search query wrapped in `<mark>`. */
export function Highlight(props: { readonly text: string; readonly query?: string | undefined }) {
  const query = (props.query ?? '').trim().toLowerCase();
  const lower = props.text.toLowerCase();
  const at = query === '' || lower.length !== props.text.length ? -1 : lower.indexOf(query);
  if (at < 0) return <>{props.text}</>;
  return (
    <>
      {props.text.slice(0, at)}
      <mark>{props.text.slice(at, at + query.length)}</mark>
      {props.text.slice(at + query.length)}
    </>
  );
}
