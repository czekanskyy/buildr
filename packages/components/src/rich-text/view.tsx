import type { BuilderComponentProps } from '@next-buildr/react';
import { renderRichText } from '@next-buildr/react';
import type { richTextProps } from './props.ts';

/**
 * The value is walked, never parsed as HTML; links go through the platform's `Link` and are
 * sanitized. A bound plain string is already a single paragraph by the time it gets here (core coerces it).
 */
export function RichTextView({
  props,
  root,
  platform,
}: BuilderComponentProps<typeof richTextProps>) {
  return <div {...root}>{renderRichText(props.content, { platform })}</div>;
}
