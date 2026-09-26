import { p } from '@next-buildr/core';

export const linkProps = {
  label: p.text({ label: 'Text', default: 'Link', bindable: true }),
  href: p.link({ label: 'Link', default: '#', bindable: true }),
  ariaLabel: p.text({ label: 'Accessible name', localizable: true }),
  newTab: p.boolean({ label: 'Open in a new tab', default: false }),
} as const;
