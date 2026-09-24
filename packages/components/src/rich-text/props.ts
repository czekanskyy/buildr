import { p } from '@buildr/core';

export const richTextProps = {
  content: p.richText({ label: 'Content', bindable: true }),
} as const;
