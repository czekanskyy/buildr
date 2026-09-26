import { p } from '@next-buildr/core';

export const richTextProps = {
  content: p.richText({ label: 'Content', bindable: true }),
} as const;
