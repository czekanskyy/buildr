import { p } from '@buildr/core';

export const paginationProps = {
  page: p.number({ label: 'Current page', min: 1, default: 1, bindable: true }),
  totalPages: p.number({ label: 'Number of pages', min: 0, default: 1, bindable: true }),
  /** Where page `n` lives: `{page}` is replaced by `n`. */
  hrefPattern: p.link({ label: 'Link pattern', default: '?page={page}' }),
  ariaLabel: p.text({ label: 'Accessible name', localizable: true }),
} as const;
